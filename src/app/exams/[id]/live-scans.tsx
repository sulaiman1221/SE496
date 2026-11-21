"use client";

import mqtt from "mqtt";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { LiveReader } from "@/lib/live-plan";

// Live card scans on the exam page. While the exam is open, the page listens
// to HiveMQ and colours the seats that have a card reader: grey until the
// student taps their card at their seat (green), red for a few seconds when
// the wrong card is tapped. Check-ins saved by the attendance listener
// (scripts/attendance-listener.mjs) start out green after a reload.

type Scan = { name: string; time: string };

type Live = {
  // False when the exam isn't open yet or HiveMQ isn't set up.
  enabled: boolean;
  // Seat codes that have a reader.
  readerSeats: Set<string>;
  // Student name -> time they tapped their card at their own seat.
  present: Map<string, string>;
  // Seat code -> the wrong card that was just tapped there.
  denied: Map<string, Scan>;
  connection: string;
  device: string;
};

const OFF: Live = {
  enabled: false,
  readerSeats: new Set(),
  present: new Map(),
  denied: new Map(),
  connection: "",
  device: "",
};

const LiveContext = createContext<Live>(OFF);

export function useLive() {
  return useContext(LiveContext);
}

const DENIED_SHOWN_MS = 8000;

export function LiveProvider({
  examId,
  broker,
  initialReaders,
  initialPresent,
  children,
}: {
  examId: string;
  // Null when the exam isn't open for check-in or HiveMQ isn't set up.
  broker: { host: string; user: string; pass: string } | null;
  initialReaders: Record<number, LiveReader>;
  // Student name -> check-in time, from the database.
  initialPresent: Record<string, string>;
  children: React.ReactNode;
}) {
  const [readers, setReaders] = useState(initialReaders);
  const [present, setPresent] = useState<Map<string, string>>(
    () => new Map(Object.entries(initialPresent)),
  );
  const [denied, setDenied] = useState<Map<string, Scan>>(new Map());
  const [connection, setConnection] = useState("Connecting");
  const [device, setDevice] = useState("ESP32 status unknown");
  const readersRef = useRef(readers);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    readersRef.current = readers;
  }, [readers]);

  useEffect(() => {
    if (!broker) return;
    const client = mqtt.connect(`wss://${broker.host}:8884/mqtt`, {
      username: broker.user,
      password: broker.pass,
      reconnectPeriod: 4000,
      clientId: `exam-${Math.random().toString(16).slice(2, 8)}`,
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
          if (plan.exam !== examId) return;
          const next: Record<number, LiveReader> = {};
          for (let n = 1; n <= 5; n++) if (plan[n]?.uid) next[n] = plan[n];
          setReaders(next);
          setDenied(new Map());
        } catch {
          // ignore a plan we can't read
        }
        return;
      }

      const m = topic.match(/^access\/seat(\d)\/(granted|alert)$/);
      if (!m) return;
      const reader = readersRef.current[Number(m[1])];
      if (!reader) return;

      let data: { name?: string } = {};
      try {
        data = JSON.parse(text);
      } catch {
        // no name to show
      }
      const name = data.name && data.name !== "unknown" ? data.name : "Unknown card";
      const time = new Date().toLocaleTimeString("en-GB", { hour12: false });

      if (m[2] === "granted") {
        setPresent((prev) => new Map(prev).set(reader.name, time));
        setDenied((prev) => {
          const next = new Map(prev);
          next.delete(reader.seat);
          return next;
        });
      } else {
        setDenied((prev) => new Map(prev).set(reader.seat, { name, time }));
        // Go back to normal after a few seconds.
        timers.current.push(
          setTimeout(() => {
            setDenied((prev) => {
              if (prev.get(reader.seat)?.time !== time) return prev;
              const next = new Map(prev);
              next.delete(reader.seat);
              return next;
            });
          }, DENIED_SHOWN_MS),
        );
      }
    });

    const pending = timers.current;
    return () => {
      client.end(true);
      pending.forEach(clearTimeout);
    };
  }, [broker, examId]);

  const value = useMemo<Live>(
    () => ({
      enabled: !!broker && Object.keys(readers).length > 0,
      readerSeats: new Set(Object.values(readers).map((r) => r.seat)),
      present,
      denied,
      connection,
      device,
    }),
    [broker, readers, present, denied, connection, device],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

// "Live: Connected · ESP32 online" above the seat map.
export function LiveStatus() {
  const live = useLive();
  if (!live.enabled) return null;
  return (
    <p className="mt-3 text-sm text-muted">
      Live check-in: {live.connection} · {live.device}
    </p>
  );
}

// Legend entries for the three live colours, next to the course colours.
export function LiveLegend() {
  const live = useLive();
  if (!live.enabled) return null;
  const items = [
    { tone: "waiting", label: "Not scanned" },
    { tone: "present", label: "Present" },
    { tone: "denied", label: "Wrong card" },
  ];
  return (
    <>
      {items.map((item) => (
        <li key={item.tone} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-3 rounded-[3px] border"
            style={{
              backgroundColor: `var(--${item.tone}-bg)`,
              borderColor: `var(--${item.tone}-border)`,
            }}
          />
          {item.label}
        </li>
      ))}
    </>
  );
}
