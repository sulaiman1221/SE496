import "server-only";
import mqtt from "mqtt";
import { CHECK_IN_STATUSES } from "@/lib/exams";
import { createServerClient } from "@/lib/supabase/server";

// The five card readers in the Demo Room, and whose card each one is paired
// with (institution_student_id). Reader N is the Nth reader on the breadboard.
// A reader isn't tied to a seat: it follows its card holder, so wherever the
// seating plan puts them (or the instructor moves them), that's the seat the
// reader stands for.
export const DEMO_READERS: { number: number; studentNumber: string }[] = [
  { number: 1, studentNumber: "1003" }, // Saleh Alkhattaf
  { number: 2, studentNumber: "1005" }, // Fayez Algosaibi
  { number: 3, studentNumber: "1001" }, // Sulaiman Alhammad
  { number: 4, studentNumber: "1002" }, // Abdullah Bin Salamah
  { number: 5, studentNumber: "1004" }, // Naif Almubarak
];

export const PLAN_TOPIC = "access/plan";

export type LiveReader = { uid: string; name: string; seat: string };

// What the ESP32 and the live feed page receive:
//   { "exam": "<id>", "room": "Demo Room",
//     "1": { "uid": "EA3CB883", "name": "Saleh Alkhattaf", "seat": "B2" }, ... }
export type LivePlan = {
  exam: string;
  room: string;
  status: string;
  readers: Record<number, LiveReader>;
};

// Reads the exam's current seating plan and works out where each reader is.
export async function loadLivePlan(examId: string): Promise<LivePlan | null> {
  const supabase = createServerClient();

  const exam = await supabase
    .from("exams")
    .select("id, status, rooms(name)")
    .eq("id", examId)
    .maybeSingle();
  if (exam.error) throw new Error(`Could not load the exam: ${exam.error.message}`);
  if (!exam.data) return null;

  const assignments = await supabase
    .from("seat_assignments")
    .select("seats(seat_code), students(full_name, institution_student_id, rfid_uid)")
    .eq("exam_id", examId);
  if (assignments.error) throw new Error(`Could not load the seats: ${assignments.error.message}`);

  const readers: Record<number, LiveReader> = {};
  for (const reader of DEMO_READERS) {
    const found = assignments.data.find(
      (a) => a.students.institution_student_id === reader.studentNumber,
    );
    if (found && found.students.rfid_uid) {
      readers[reader.number] = {
        uid: found.students.rfid_uid.toUpperCase(),
        name: found.students.full_name,
        seat: found.seats.seat_code,
      };
    }
  }

  return { exam: exam.data.id, room: exam.data.rooms.name, status: exam.data.status, readers };
}

// Sends the current plan to HiveMQ as a retained message, so the ESP32 gets it
// now and again whenever it reconnects. Does nothing until the exam is
// approved. Returns an error message for the instructor, or null.
export async function publishLivePlan(examId: string): Promise<{ error: string | null }> {
  let plan: LivePlan | null;
  try {
    plan = await loadLivePlan(examId);
  } catch (e) {
    console.error("Live plan:", e);
    return { error: "Couldn't read the seating plan." };
  }
  if (!plan) return { error: "Exam not found." };
  // Before approval the readers don't need the plan, so HiveMQ isn't needed either.
  if (!(CHECK_IN_STATUSES as string[]).includes(plan.status)) return { error: null };

  const host = process.env.HIVEMQ_HOST;
  const username = process.env.HIVEMQ_PUBLISH_USER;
  const password = process.env.HIVEMQ_PUBLISH_PASS;
  if (!host || !username || !password) {
    return { error: "HiveMQ isn't set up. Add the HIVEMQ_* keys to your .env file." };
  }

  const message: Record<string, unknown> = { exam: plan.exam, room: plan.room };
  for (const [number, reader] of Object.entries(plan.readers)) message[number] = reader;

  try {
    const client = await mqtt.connectAsync(`mqtts://${host}:8883`, {
      username,
      password,
      connectTimeout: 8000,
      reconnectPeriod: 0,
    });
    try {
      await client.publishAsync(PLAN_TOPIC, JSON.stringify(message), { qos: 1, retain: true });
    } finally {
      await client.endAsync();
    }
  } catch (e) {
    console.error("HiveMQ publish failed:", e);
    return { error: "Couldn't reach HiveMQ. Check the HIVEMQ_* keys and the internet connection." };
  }
  return { error: null };
}
