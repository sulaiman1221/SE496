// Saves every card tap to the database, so attendance is kept after the exam,
// for example to find who missed it for a makeup exam.
//
// The ESP32 decides green or red itself and reports each tap to HiveMQ. This
// listens to those reports and records them:
//   access/plan               the current plan: reader number -> student, card, seat (retained)
//   access/seat<N>/granted    reader N accepted a card: that student is present
//   access/seat<N>/alert      reader N rejected a card
//
// Accepted taps mark the student present in `attendance` (keeping the time
// they first checked in), and every tap goes into `attendance_scans`. Keep it
// running next to the app during the exam:
//   npm run listen
// Taps made while it isn't running still show on the readers but aren't saved.

import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import mqtt from "mqtt";

// Same as CHECK_IN_STATUSES in src/lib/exams.ts.
const CHECK_IN_STATUSES = ["approved", "notifications_sent", "in_progress"];

// Records one tap reported by reader `readerNumber` while `plan` is the
// current plan. `data` is the reader's message: { name?, uid?, message? }.
// Returns a line for the log; throws if the database can't be reached.
export function createScanRecorder(supabase) {
  return async function recordScan(plan, readerNumber, granted, data) {
    const reader = plan?.[readerNumber];
    if (!plan?.exam || !reader) {
      return `Reader ${readerNumber}: no seating plan for this reader yet. Not saved.`;
    }

    const exam = await supabase
      .from("exams")
      .select("id, status, room_id")
      .eq("id", plan.exam)
      .maybeSingle();
    if (exam.error) throw new Error(`Couldn't load the exam: ${exam.error.message}`);
    if (!exam.data) return `Reader ${readerNumber}: exam ${plan.exam} not found. Not saved.`;

    // An accepted card is the reader's own card holder. For a wrong card the
    // reader may send its UID; without one the card stays unknown.
    const cardUid = (data.uid ? String(data.uid) : granted ? reader.uid : "").toUpperCase();
    const readerCode = `R0${readerNumber}`;

    // Each reader stands at its card holder's seat, wherever the plan puts them.
    const [seat, readerRow, student] = await Promise.all([
      supabase
        .from("seats")
        .select("id")
        .eq("room_id", exam.data.room_id)
        .eq("seat_code", reader.seat)
        .maybeSingle(),
      supabase.from("readers").select("id").eq("hardware_identifier", readerCode).maybeSingle(),
      cardUid
        ? supabase
            .from("students")
            .select("id, full_name")
            .ilike("rfid_uid", cardUid.replace(/[\\%_]/g, (c) => `\\${c}`))
            .maybeSingle()
        : { data: null, error: null },
    ]);
    for (const [what, res] of [["seat", seat], ["reader", readerRow], ["student", student]]) {
      if (res.error) throw new Error(`Couldn't load the ${what}: ${res.error.message}`);
    }

    const open = CHECK_IN_STATUSES.includes(exam.data.status);
    const accepted = granted && open && !!student.data;
    const wrongName = data.name && data.name !== "unknown" ? data.name : null;
    const reason = !open
      ? "This exam isn't open for check-in."
      : !granted
        ? `Wrong card${wrongName ? ` (${wrongName})` : ""} at seat ${reader.seat}.`
        : !student.data
          ? "Card not registered."
          : null;

    const logged = await supabase.from("attendance_scans").insert({
      exam_id: exam.data.id,
      reader_id: readerRow.data?.id ?? null,
      reader_code: readerCode,
      card_uid: cardUid || "unknown",
      student_id: student.data?.id ?? null,
      seat_id: seat.data?.id ?? null,
      result: accepted ? "accepted" : "rejected",
      reason,
    });
    if (logged.error) throw new Error(`Couldn't log the scan: ${logged.error.message}`);

    const where = `${reader.seat} (reader ${readerNumber})`;
    if (!accepted) return `${where}: rejected. ${reason}`;

    // Mark them present, keeping the time they first checked in.
    const existing = await supabase
      .from("attendance")
      .select("status")
      .eq("exam_id", exam.data.id)
      .eq("student_id", student.data.id)
      .maybeSingle();
    if (existing.error) throw new Error(`Couldn't load attendance: ${existing.error.message}`);
    if (existing.data?.status === "present") {
      return `${where}: ${student.data.full_name} is already checked in.`;
    }

    const present = {
      status: "present",
      checked_in_at: new Date().toISOString(),
      seat_id: seat.data?.id ?? null,
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
    if (saved.error) throw new Error(`Couldn't save attendance: ${saved.error.message}`);

    // The first check-in starts the exam.
    if (exam.data.status !== "in_progress") {
      await supabase
        .from("exams")
        .update({ status: "in_progress" })
        .eq("id", exam.data.id)
        .in("status", ["approved", "notifications_sent"]);
    }
    return `${where}: ${student.data.full_name} present.`;
  };
}

class NoWebSocket {
  constructor() {
    throw new Error("Supabase realtime isn't used by the attendance listener.");
  }
}

// Loads keys from .env.local and .env, like the app does. Keys already set
// in the environment win, then .env.local, then .env.
function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
      }
    }
  }
}

function main() {
  loadEnv();
  const env = process.env;
  const missing = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "HIVEMQ_HOST",
    "HIVEMQ_VIEWER_USER",
    "HIVEMQ_VIEWER_PASS",
  ].filter((key) => !env[key]);
  if (missing.length > 0) {
    console.error(`Missing ${missing.join(", ")} in .env.local or .env.`);
    process.exit(1);
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    // supabase-js wants a WebSocket for its realtime feature even though this
    // never uses it, and Node 20 has none built in. A stand-in that is never
    // called lets it start on Node 20 as well as 22.
    realtime: { transport: globalThis.WebSocket ?? NoWebSocket },
  });
  const recordScan = createScanRecorder(supabase);

  // The viewer login can only listen, which is all this needs.
  const client = mqtt.connect(`mqtts://${env.HIVEMQ_HOST}:8883`, {
    username: env.HIVEMQ_VIEWER_USER,
    password: env.HIVEMQ_VIEWER_PASS,
    reconnectPeriod: 4000,
    clientId: `attendance-${Math.random().toString(16).slice(2, 8)}`,
  });
  const time = () => new Date().toLocaleTimeString("en-GB", { hour12: false });

  let plan = null;
  // One tap at a time, in the order they arrive.
  let queue = Promise.resolve();

  client.on("connect", () => {
    console.log(`${time()} Connected to HiveMQ. Saving card taps; press Ctrl+C to stop.`);
    client.subscribe("access/#");
  });
  client.on("close", () => console.log(`${time()} Disconnected from HiveMQ, retrying...`));
  client.on("error", (e) => console.error(`${time()} HiveMQ error: ${e.message}`));

  client.on("message", (topic, payload) => {
    const text = payload.toString();

    if (topic === "access/plan") {
      try {
        plan = JSON.parse(text);
        const readers = Object.keys(plan).filter((key) => /^\d+$/.test(key)).length;
        console.log(`${time()} Seating plan received: exam ${plan.exam}, ${readers} readers.`);
      } catch {
        console.error(`${time()} Couldn't read the seating plan message.`);
      }
      return;
    }

    const match = topic.match(/^access\/seat(\d+)\/(granted|alert)$/);
    if (!match) return;
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      // not JSON: nothing extra to read
    }
    const currentPlan = plan;
    queue = queue
      .then(() => recordScan(currentPlan, match[1], match[2] === "granted", data))
      .then((line) => console.log(`${time()} ${line}`))
      .catch((e) => console.error(`${time()} Scan not saved: ${e.message}`));
  });
}

// Run main() only when started directly, not when imported.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
