"use client";

import mqtt from "mqtt";
import { useEffect, useRef, useState, useTransition } from "react";
import type { LiveReader } from "@/lib/live-plan";
import { seatRows, type SeatInput } from "@/lib/seating";
import { resendPlanToReaders } from "../../actions";

type Readers = Record<number, LiveReader>;
type Scan = { seat: string; name: string; granted: boolean; time: string };
type Log = { id: number; time: string; text: string; granted: boolean };

// Shows the room's seats and listens to HiveMQ:
//   access/plan               the current plan (reader -> student -> seat), retained
//   access/status             "online" / "offline" from the ESP32
//   access/seat<N>/granted    reader N accepted a card
//   access/seat<N>/alert      reader N rejected a card
export function LiveFeed({
  examId,
  seats,
  initialReaders,
  broker,
}: {
  examId: string;
  seats: SeatInput[];
  initialReaders: Readers;
  broker: { host: string; user: string; pass: string };
}) {
  const [readers, setReaders] = useState<Readers>(initialReaders);
  const [connection, setConnection] = useState("Connecting");
  const [device, setDevice] = useState("ESP32 status unknown");
  const [lastScan, setLastScan] = useState<Record<string, Scan>>({});
  const [log, setLog] = useState<Log[]>([]);
  const readersRef = useRef(readers);
  const nextLogId = useRef(0);

  useEffect(() => {
    readersRef.current = readers;
  }, [readers]);

  useEffect(() => {
    const client = mqtt.connect(`wss://${broker.host}:8884/mqtt`, {
      username: broker.user,
      password: broker.pass,
      reconnectPeriod: 4000,
      clientId: `live-${Math.random().toString(16).slice(2, 8)}`,
    });

    client.on("connect", () => {
      setConnection("Connected");
      client.subscribe("access/#");
    });
    client.on("close", () => setConnection("Disconnected"));
    client.on("error", (e) => setConnection(`Error: ${e.message}`));

    client.on("message", (topic, payload) => {
      const text = payload.toString();

      if (topic === "access/status") {
        setDevice(`ESP32 ${text === "online" ? "online" : "offline"}`);
        return;
      }

      if (topic === "access/plan") {
        try {
          const plan = JSON.parse(text);
          if (plan.exam !== examId) return; // a plan for a different exam
          const next: Readers = {};
          for (let n = 1; n <= 5; n++) if (plan[n]?.uid) next[n] = plan[n];
          setReaders(next);
          setLastScan({}); // new seats, so earlier results no longer apply
        } catch {
          // ignore a plan we can't read
        }
        return;
      }

      const m = topic.match(/^access\/seat(\d)\/(granted|alert)$/);
      if (!m) return;
      const reader = readersRef.current[Number(m[1])];
      if (!reader) return;
      let data: { name?: string; message?: string } = {};
      try {
        data = JSON.parse(text);
      } catch {
        // show the raw text if it isn't JSON
        data = { message: text };
      }
      const granted = m[2] === "granted";
      const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
      const name = data.name && data.name !== "unknown" ? data.name : "Unknown card";

      setLastScan((prev) => ({ ...prev, [reader.seat]: { seat: reader.seat, name, granted, time } }));
      setLog((prev) =>
        [
          {
            id: nextLogId.current++,
            time,
            text: `${data.message ?? (granted ? "ACCESS GRANTED" : "ACCESS DENIED")} (${reader.seat})`,
            granted,
          },
          ...prev,
        ].slice(0, 100),
      );
    });

    return () => {
      client.end(true);
    };
  }, [broker.host, broker.user, broker.pass, examId]);

  // Which reader (if any) stands at each seat.
  const readerAt = new Map<string, number>();
  for (const [n, r] of Object.entries(readers)) readerAt.set(r.seat, Number(n));

  const columns = Math.max(...seats.map((s) => s.col)) + 1;
  const rows = seatRows(seats);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted">
          {connection} · {device}
        </p>
        <ResendButton examId={examId} />
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: `${columns * 9}rem` }}>
          <div className="mb-4 border-b-2 border-ink/70 pb-1.5 text-center text-xs tracking-wide text-muted uppercase">
            Front
          </div>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {rows.flatMap((row, r) =>
              row.map((seat) => {
                const number = readerAt.get(seat.code);
                const reader = number ? readers[number] : undefined;
                const scan = lastScan[seat.code];
                const tone = scan
                  ? scan.granted
                    ? "border-emerald-600 bg-emerald-100 dark:bg-emerald-900/40"
                    : "border-red-600 bg-red-100 dark:bg-red-900/40"
                  : "border-line bg-surface";
                return (
                  <div
                    key={seat.id}
                    className={`min-w-0 rounded-[6px] border-2 p-3 transition-colors ${tone}`}
                    style={{ gridRow: r + 1, gridColumn: seat.col + 1 }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-sm font-medium">{seat.code}</span>
                      <span className="text-xs text-muted">
                        {number ? `Reader ${number}` : "No reader"}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-sm">{reader ? reader.name : "Empty"}</p>
                    <p className="mt-1 text-xs text-muted">
                      {scan
                        ? `${scan.granted ? "Granted" : `Denied: ${scan.name}`} at ${scan.time}`
                        : reader
                          ? "Waiting for card"
                          : ""}
                    </p>
                  </div>
                );
              }),
            )}
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-medium">Scans</h2>
        {log.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No scans yet.</p>
        ) : (
          <ul className="mt-3 border-t border-line">
            {log.map((entry) => (
              <li
                key={entry.id}
                className="flex gap-3 border-b border-line py-2 text-sm tabular-nums"
              >
                <time className="text-muted">{entry.time}</time>
                <span
                  className={
                    entry.granted
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-red-700 dark:text-red-400"
                  }
                >
                  {entry.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ResendButton({ examId }: { examId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      {result && <span className="text-muted">{result}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const { error } = await resendPlanToReaders(examId);
            setResult(error ?? "Plan sent to the readers.");
          })
        }
        className="rounded-[5px] border border-line bg-surface px-3 py-1.5 text-sm font-medium transition-colors hover:bg-hover disabled:opacity-60"
      >
        {pending ? "Sending…" : "Resend plan to readers"}
      </button>
    </div>
  );
}
