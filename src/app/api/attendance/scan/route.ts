import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { CHECK_IN_STATUSES, isUuid } from "@/lib/exams";
import { createServerClient } from "@/lib/supabase/server";

// Card readers call this when a student taps their ID card:
//
//   POST /api/attendance/scan
//   Authorization: Bearer <READER_API_KEY>
//   { "exam_id": "<exam uuid>", "reader_id": "R01", "card_uid": "04A1B2C3" }
//
// and get back { result: "accepted" | "rejected", message, ... }, which the
// reader shows as green or red. A card is accepted only at the seat its
// student is assigned in this exam. The seat plan is read at every scan, so a
// student moved during the exam is accepted at their new seat from then on.
// Every scan is logged in attendance_scans; attendance keeps the time each
// student first checked in.

type Answer = {
  result: "accepted" | "rejected";
  message: string;
  student?: string;
  // The student's assigned seat: where they sat down, or where they should go.
  seat?: string;
};

export async function POST(request: Request) {
  if (!process.env.READER_API_KEY) {
    return NextResponse.json(
      { error: "Card readers aren't set up. Add READER_API_KEY to the environment." },
      { status: 503 },
    );
  }
  if (!validReaderKey(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Invalid reader key." }, { status: 401 });
  }

  const body: Record<string, unknown> | null = await request.json().catch(() => null);
  const examId = body?.exam_id;
  const readerCode = typeof body?.reader_id === "string" ? body.reader_id.trim() : "";
  const cardUid = typeof body?.card_uid === "string" ? body.card_uid.trim() : "";
  if (typeof examId !== "string" || !readerCode || !cardUid) {
    return NextResponse.json({ error: "Send exam_id, reader_id and card_uid." }, { status: 400 });
  }

  const supabase = createServerClient();

  // Filled in as the scan is matched up, and saved with the answer.
  const log: {
    exam_id: string | null;
    reader_id: string | null;
    seat_id: string | null;
    student_id: string | null;
  } = { exam_id: null, reader_id: null, seat_id: null, student_id: null };

  const answer = async (a: Answer) => {
    const { error } = await supabase.from("attendance_scans").insert({
      ...log,
      reader_code: readerCode,
      card_uid: cardUid,
      result: a.result,
      reason: a.result === "rejected" ? a.message : null,
    });
    if (error) console.error("Couldn't log card scan:", error.message);
    return NextResponse.json(a);
  };
  const reject = (message: string, extra: Partial<Answer> = {}) =>
    answer({ result: "rejected", message, ...extra });
  const failed = (what: string, message: string) => {
    console.error(`Card scan: couldn't load ${what}:`, message);
    return NextResponse.json({ error: "Couldn't check the card. Try again." }, { status: 500 });
  };

  // The exam.
  const exam = isUuid(examId)
    ? await supabase.from("exams").select("id, status, room_id").eq("id", examId).maybeSingle()
    : { data: null, error: null };
  if (exam.error) return failed("the exam", exam.error.message);
  if (!exam.data) return reject("Exam not found.");
  log.exam_id = exam.data.id;

  // The reader, and the seat it's at.
  const reader = await supabase
    .from("readers")
    .select("id, is_active, seat_id, seats(seat_code, room_id)")
    .eq("hardware_identifier", readerCode)
    .maybeSingle();
  if (reader.error) return failed("the reader", reader.error.message);
  if (!reader.data) return reject("Unknown reader.");
  log.reader_id = reader.data.id;
  log.seat_id = reader.data.seat_id;
  if (!reader.data.is_active || !reader.data.seat_id || !reader.data.seats) {
    return reject("This reader isn't set up at a seat.");
  }
  if (reader.data.seats.room_id !== exam.data.room_id) {
    return reject("This reader isn't in this exam's room.");
  }
  if (!(CHECK_IN_STATUSES as string[]).includes(exam.data.status)) {
    return reject("This exam isn't open for check-in.");
  }

  // The student whose card this is. Card UIDs match regardless of letter case.
  const student = await supabase
    .from("students")
    .select("id, full_name")
    .ilike("rfid_uid", cardUid.replace(/[\\%_]/g, (c) => `\\${c}`))
    .maybeSingle();
  if (student.error) return failed("the student", student.error.message);
  if (!student.data) return reject("Card not registered.");
  log.student_id = student.data.id;
  const name = student.data.full_name;

  // Where the seat plan puts them right now, after any moves.
  const assignment = await supabase
    .from("seat_assignments")
    .select("seat_id, seats(seat_code)")
    .eq("exam_id", exam.data.id)
    .eq("student_id", student.data.id)
    .maybeSingle();
  if (assignment.error) return failed("the seat plan", assignment.error.message);
  if (!assignment.data) return reject(`${name} doesn't have a seat in this exam.`, { student: name });

  const assignedSeat = assignment.data.seats.seat_code;
  if (assignment.data.seat_id !== reader.data.seat_id) {
    return reject(`Wrong seat. ${name}'s seat is ${assignedSeat}.`, {
      student: name,
      seat: assignedSeat,
    });
  }

  // Right seat. Mark them present, keeping the time they first checked in.
  const existing = await supabase
    .from("attendance")
    .select("status")
    .eq("exam_id", exam.data.id)
    .eq("student_id", student.data.id)
    .maybeSingle();
  if (existing.error) return failed("attendance", existing.error.message);

  const alreadyPresent = existing.data?.status === "present";
  if (!alreadyPresent) {
    const present = {
      status: "present",
      checked_in_at: new Date().toISOString(),
      seat_id: reader.data.seat_id,
    };
    const saved = existing.data
      ? await supabase
          .from("attendance")
          .update(present)
          .eq("exam_id", exam.data.id)
          .eq("student_id", student.data.id)
      : await supabase
          .from("attendance")
          .upsert(
            { exam_id: exam.data.id, student_id: student.data.id, ...present },
            { onConflict: "exam_id,student_id", ignoreDuplicates: true },
          );
    if (saved.error) return failed("attendance", saved.error.message);

    // The first check-in starts the exam.
    if (exam.data.status !== "in_progress") {
      await supabase
        .from("exams")
        .update({ status: "in_progress" })
        .eq("id", exam.data.id)
        .in("status", ["approved", "notifications_sent"]);
    }
  }

  return answer({
    result: "accepted",
    message: alreadyPresent ? `${name} is already checked in.` : `Welcome, ${name}.`,
    student: name,
    seat: assignedSeat,
  });
}

// Readers send the shared key as "Authorization: Bearer <key>". Compared in
// constant time so the key can't be guessed from response timings.
function validReaderKey(header: string | null) {
  const expected = Buffer.from(`Bearer ${process.env.READER_API_KEY}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
