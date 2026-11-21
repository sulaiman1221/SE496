// Sets up the hardware demo data: the five RFID cards on their students, and a
// DEMO course holding just those five. Same changes as
// supabase/migrations/20261111120000_demo_card_holders.sql, for when you can't
// open the Supabase SQL editor. Safe to run more than once.
//
// Run from the project folder:
//   node --env-file=.env.local scripts/seed-demo.mjs

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local.");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

// Reader number, student ID, name, card UID
const CARDS = [
  [1, "1003", "Saleh Alkhattaf", "EA3CB883"],
  [2, "1005", "Fayez Algosaibi", "BB6DCF55"],
  [3, "1001", "Sulaiman Alhammad", "AB019955"],
  [4, "1002", "Abdullah Bin Salamah", "3B07EE53"],
  [5, "1004", "Naif Almubarak", "7BE70854"],
];

function fail(what, error) {
  console.error(`Failed: ${what}\n  ${error.message}`);
  process.exit(1);
}

// 1. Cards on students
const studentIds = [];
for (const [reader, number, name, uid] of CARDS) {
  const { data, error } = await supabase
    .from("students")
    .update({ rfid_uid: uid })
    .eq("institution_student_id", number)
    .select("id, full_name");
  if (error) fail(`setting the card for ${name}`, error);
  if (data.length === 0) {
    console.error(`Student ${number} (${name}) isn't in the database.`);
    process.exit(1);
  }
  studentIds.push(data[0].id);
  console.log(`Reader ${reader}: ${data[0].full_name} -> card ${uid}`);
}

// 2. DEMO course
const course = await supabase
  .from("courses")
  .upsert({ course_code: "DEMO", course_name: "RFID Hardware Demo" }, { onConflict: "course_code" })
  .select("id")
  .single();
if (course.error) fail("creating the DEMO course", course.error);

// 3. Enroll the five
const enroll = await supabase.from("enrollments").upsert(
  studentIds.map((student_id) => ({ student_id, course_id: course.data.id })),
  { onConflict: "student_id,course_id" },
);
if (enroll.error) fail("enrolling the students", enroll.error);
console.log("DEMO course ready with 5 students.");

// 4. The room the demo uses
const room = await supabase
  .from("rooms")
  .select("name, seats(seat_code, is_active)")
  .eq("name", "Demo Room")
  .maybeSingle();
if (room.error) fail("looking for the Demo Room", room.error);
if (!room.data) {
  console.warn("Warning: there is no room called 'Demo Room' in this database.");
} else {
  const active = room.data.seats.filter((s) => s.is_active).length;
  console.log(`Demo Room found with ${active} active seats${active === 5 ? "." : " (the demo expects 5)."}`);
}
