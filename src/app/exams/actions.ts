"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { isUuid, todayISODate } from "@/lib/exams";
import { MicrosoftSignInError, refreshTokens, sendMail } from "@/lib/microsoft";
import { getExamDetail } from "@/lib/queries";
import {
  generateSeating,
  isGender,
  isSeatingRule,
  normalizeRules,
  type StudentInput,
} from "@/lib/seating";
import { createSeatingPlanPdf } from "@/lib/seating-pdf";
import { isTestAddress, seatEmail } from "@/lib/seat-email";

export type CreateExamState = { error: string | null };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export async function createExam(
  _prev: CreateExamState,
  formData: FormData,
): Promise<CreateExamState> {
  const courseIds = [...new Set(formData.getAll("courseId").map(String))];
  const roomId = String(formData.get("roomId") ?? "");
  const examDate = String(formData.get("examDate") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const title = String(formData.get("title") ?? "").trim();

  if (courseIds.length === 0 || !courseIds.every(isUuid)) {
    return { error: "Select at least one course." };
  }
  if (!isUuid(roomId)) {
    return { error: "Select a room." };
  }
  if (!DATE_RE.test(examDate)) {
    return { error: "Enter the exam date." };
  }
  if (examDate < todayISODate()) {
    return { error: "The exam date can't be in the past." };
  }
  if (!TIME_RE.test(startTime)) {
    return { error: "Enter a start time." };
  }
  if (endTime && (!TIME_RE.test(endTime) || endTime <= startTime)) {
    return { error: "The end time must be after the start time." };
  }

  const supabase = createServerClient();

  const [coursesRes, enrollmentsRes, seatsRes] = await Promise.all([
    supabase.from("courses").select("id").in("id", courseIds),
    supabase.from("enrollments").select("student_id").in("course_id", courseIds),
    supabase.from("seats").select("id").eq("room_id", roomId).eq("is_active", true),
  ]);

  if (coursesRes.error || enrollmentsRes.error || seatsRes.error) {
    return { error: "Something went wrong loading the courses and room. Try again." };
  }
  if (coursesRes.data.length !== courseIds.length) {
    return { error: "One of the selected courses no longer exists." };
  }

  const studentCount = new Set(enrollmentsRes.data.map((e) => e.student_id)).size;
  const seatCount = seatsRes.data.length;

  if (studentCount === 0) {
    return { error: "The selected courses have no enrolled students." };
  }
  if (studentCount > seatCount) {
    return {
      error: `${studentCount} students won't fit in a room with ${seatCount} seats.`,
    };
  }

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .insert({
      room_id: roomId,
      exam_date: examDate,
      start_time: startTime,
      end_time: endTime || null,
      title: title || null,
    })
    .select("id")
    .single();

  if (examError) {
    return { error: "Couldn't save the exam. Try again." };
  }

  const { error: linkError } = await supabase
    .from("exam_courses")
    .insert(courseIds.map((courseId) => ({ exam_id: exam.id, course_id: courseId })));

  if (linkError) {
    // Don't leave an exam with no courses behind.
    await supabase.from("exams").delete().eq("id", exam.id);
    return { error: "Couldn't save the exam. Try again." };
  }

  redirect(`/exams/${exam.id}`);
}

export type GenerateSeatingState = { error: string | null };

// A plan can only be (re)generated before it's approved.
const EDITABLE_STATUSES = ["draft", "generated"];

export async function generateSeatingPlan(
  examId: string,
  _prev: GenerateSeatingState,
  formData: FormData,
): Promise<GenerateSeatingState> {
  // Any combination of rules, including none.
  const values = formData.getAll("rule");
  if (!isUuid(examId)) return { error: "Exam not found." };
  if (!values.every(isSeatingRule)) return { error: "Choose seating rules from the list." };
  const rules = normalizeRules(values);

  const supabase = createServerClient();

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id, status, room_id, exam_courses(course_id, courses(course_code))")
    .eq("id", examId)
    .maybeSingle();

  if (examError) return { error: "Couldn't load the exam. Try again." };
  if (!exam) return { error: "Exam not found." };
  if (!EDITABLE_STATUSES.includes(exam.status)) {
    return { error: "This seating plan has been approved and can't be regenerated." };
  }

  // Course order decides which course a student counts under if they're
  // enrolled in more than one of the exam's courses.
  const courseIds = exam.exam_courses
    .sort((a, b) => a.courses.course_code.localeCompare(b.courses.course_code))
    .map((ec) => ec.course_id);

  if (rules.includes("alternate") && courseIds.length < 2) {
    return { error: "Alternating courses needs at least two courses in the exam." };
  }

  const [enrollmentsRes, seatsRes] = await Promise.all([
    supabase
      .from("enrollments")
      .select("student_id, course_id, students(gender)")
      .in("course_id", courseIds),
    supabase
      .from("seats")
      .select("id, seat_code, row_index, column_index")
      .eq("room_id", exam.room_id)
      .eq("is_active", true),
  ]);

  if (enrollmentsRes.error || seatsRes.error) {
    return { error: "Couldn't load the students and seats. Try again." };
  }

  const students = new Map<string, StudentInput>();
  // Male and female students sit on separate sides, so everyone needs a gender.
  const missingGender = new Set<string>();
  for (const courseId of courseIds) {
    for (const e of enrollmentsRes.data.filter((e) => e.course_id === courseId)) {
      const gender = e.students.gender;
      if (!isGender(gender)) missingGender.add(e.student_id);
      else if (!students.has(e.student_id)) {
        students.set(e.student_id, { id: e.student_id, courseId, gender });
      }
    }
  }

  if (missingGender.size > 0) {
    const n = missingGender.size;
    return {
      error: `${n} ${n === 1 ? "student has" : "students have"} no gender set. Add it in the students table, then generate again.`,
    };
  }

  const seats = seatsRes.data.map((s) => ({
    id: s.id,
    code: s.seat_code,
    row: s.row_index,
    col: s.column_index,
  }));

  const result = generateSeating(seats, [...students.values()], rules);
  if (!result.ok) return { error: result.error };

  // Replace any previous plan for this exam.
  const { error: deleteError } = await supabase
    .from("seat_assignments")
    .delete()
    .eq("exam_id", exam.id);
  if (deleteError) return { error: "Couldn't save the seating plan. Try again." };

  const { error: insertError } = await supabase.from("seat_assignments").insert(
    result.assignments.map((a) => ({
      exam_id: exam.id,
      seat_id: a.seatId,
      student_id: a.studentId,
      course_id: a.courseId,
    })),
  );

  if (insertError) {
    await supabase.from("exams").update({ status: "draft" }).eq("id", exam.id);
    refresh();
    return { error: "Couldn't save the seating plan. Try again." };
  }

  const { error: updateError } = await supabase
    .from("exams")
    .update({ status: "generated", seating_constraints: { rules } })
    .eq("id", exam.id);
  if (updateError) return { error: "The plan was saved but the exam status didn't update. Try again." };

  refresh();
  return { error: null };
}

export type ApproveState = { error: string | null };

// Approving locks the plan: generateSeatingPlan refuses approved exams.
// Emailing students is a separate step.
export async function approveSeatingPlan(examId: string): Promise<ApproveState> {
  if (!isUuid(examId)) return { error: "Exam not found." };

  const supabase = createServerClient();

  const { count, error: countError } = await supabase
    .from("seat_assignments")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId);
  if (countError) return { error: "Couldn't approve the plan. Try again." };
  if (!count) return { error: "Generate a seating plan before approving it." };

  // Only a generated plan can be approved, which also stops double approval.
  const { data, error } = await supabase
    .from("exams")
    .update({ status: "approved" })
    .eq("id", examId)
    .eq("status", "generated")
    .select("id");
  if (error) return { error: "Couldn't approve the plan. Try again." };
  if (data.length === 0) return { error: "This plan can't be approved right now. Refresh the page." };

  refresh();
  return { error: null };
}

export type SendSeatEmailsState = { error: string | null; message: string | null };

// Emails each student their seat from the connected Outlook account. Students
// who already got theirs are left out, so running it again retries only the
// ones that failed or were skipped. Once nobody is left to email, the exam
// moves to notifications_sent.
export async function sendSeatEmails(examId: string): Promise<SendSeatEmailsState> {
  const fail = (error: string) => ({ error, message: null });
  if (!isUuid(examId)) return fail("Exam not found.");

  const exam = await getExamDetail(examId).catch(() => undefined);
  if (exam === undefined) return fail("Couldn't load the exam. Try again.");
  if (!exam) return fail("Exam not found.");
  if (exam.status !== "approved" && exam.status !== "notifications_sent") {
    return fail("Approve the seating plan before emailing students.");
  }
  if (exam.seat_assignments.length === 0) return fail("This exam has no seating plan.");

  const supabase = createServerClient();

  const { data: sender, error: senderError } = await supabase
    .from("email_sender")
    .select("refresh_token")
    .maybeSingle();
  if (senderError) return fail("Couldn't load the Outlook account. Try again.");
  if (!sender) return fail("Connect an Outlook account first.");

  const alreadySent = new Set(
    exam.seat_emails.filter((e) => e.status === "sent").map((e) => e.student_id),
  );
  const toSend = exam.seat_assignments.filter((a) => !alreadySent.has(a.student_id));
  if (toSend.length === 0) return { error: null, message: "Every student has been emailed." };

  let accessToken: string;
  try {
    const tokens = await refreshTokens(sender.refresh_token);
    accessToken = tokens.accessToken;
    if (tokens.refreshToken !== sender.refresh_token) {
      await supabase
        .from("email_sender")
        .update({ refresh_token: tokens.refreshToken })
        .eq("id", true);
    }
  } catch (e) {
    if (e instanceof MicrosoftSignInError) {
      return fail("The Outlook sign-in has expired. Connect the account again.");
    }
    console.error(e);
    return fail("Couldn't sign in to Outlook. Try again.");
  }

  // The same seating plan PDF as the Download PDF button, attached to every email.
  const plan = await createSeatingPlanPdf(exam).catch((e) => {
    console.error(e);
    return null;
  });
  if (!plan) return fail("Couldn't create the seating plan PDF. Try again.");
  const planPdf = { name: plan.filename, contentType: "application/pdf", content: plan.pdf };

  const courses = new Map(exam.exam_courses.map((ec) => [ec.courses.id, ec.courses]));
  const seatCodes = new Map(exam.rooms.seats.map((s) => [s.id, s.seat_code]));

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let unsaved = 0;
  let signInExpired = false;

  // One at a time, saving each result straight away, so a crash halfway
  // through doesn't lose track of who already got an email.
  for (const a of toSend) {
    const email = a.students.email;
    let status: "sent" | "failed" | "skipped";
    let error: string | null = null;

    if (isTestAddress(email)) {
      status = "skipped";
      error = "Test address, not sent.";
    } else if (signInExpired) {
      status = "failed";
      error = "Not sent: the Outlook sign-in expired.";
    } else {
      const course = courses.get(a.course_id);
      try {
        await sendMail(accessToken, {
          to: email,
          ...seatEmail({
            studentName: a.students.full_name,
            examTitle: exam.title ?? `the ${course?.course_code ?? ""} exam`,
            courseCode: course?.course_code ?? "",
            courseName: course?.course_name ?? "",
            examDate: exam.exam_date,
            startTime: exam.start_time,
            endTime: exam.end_time,
            roomName: exam.rooms.name,
            seatCode: seatCodes.get(a.seat_id) ?? "",
          }),
          attachments: [planPdf],
        });
        status = "sent";
      } catch (e) {
        status = "failed";
        error = e instanceof Error ? e.message : "Unknown error.";
        if (e instanceof MicrosoftSignInError) signInExpired = true;
      }
    }

    if (status === "sent") sent++;
    else if (status === "failed") failed++;
    else skipped++;

    const { error: saveError } = await supabase.from("seat_emails").upsert(
      {
        exam_id: exam.id,
        student_id: a.student_id,
        email,
        status,
        error,
        sent_at: status === "sent" ? new Date().toISOString() : null,
      },
      { onConflict: "exam_id,student_id" },
    );
    if (saveError) unsaved++;
  }

  if (failed === 0 && unsaved === 0 && alreadySent.size + sent > 0) {
    await supabase
      .from("exams")
      .update({ status: "notifications_sent" })
      .eq("id", exam.id)
      .eq("status", "approved");
  }

  refresh();

  const summary = [
    `${sent} ${sent === 1 ? "email" : "emails"} sent`,
    failed > 0 && `${failed} failed`,
    skipped > 0 && `${skipped} skipped (test ${skipped === 1 ? "address" : "addresses"})`,
  ]
    .filter(Boolean)
    .join(", ");

  if (signInExpired) {
    return fail(`${summary}. The Outlook sign-in expired. Connect the account again, then retry.`);
  }
  if (unsaved > 0) {
    return fail(`${summary}. Some results couldn't be saved, so those students may be emailed again.`);
  }
  if (failed > 0) return fail(`${summary}. Email students again to retry the failed ones.`);
  return { error: null, message: `${summary}.` };
}
