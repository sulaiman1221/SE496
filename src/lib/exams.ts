export type ExamStatus =
  | "draft"
  | "generated"
  | "approved"
  | "notifications_sent"
  | "in_progress"
  | "completed";

// What the instructor sees for each status: the next thing to do, in plain words.
export const STATUS_LABELS: Record<ExamStatus, string> = {
  draft: "Seating not generated",
  generated: "Ready to approve",
  approved: "Approved, emails not sent",
  notifications_sent: "Students notified",
  in_progress: "In progress",
  completed: "Completed",
};

export const STATUS_COLORS: Record<ExamStatus, string> = {
  draft: "#a29d94",
  generated: "#b7791f",
  approved: "#1f3a5f",
  notifications_sent: "#2f6b4f",
  in_progress: "#2f6b4f",
  completed: "#a29d94",
};

export function statusLabel(status: string) {
  return STATUS_LABELS[status as ExamStatus] ?? status;
}

export function statusColor(status: string) {
  return STATUS_COLORS[status as ExamStatus] ?? "#a29d94";
}

// Exam dates are stored as plain calendar dates (YYYY-MM-DD) with no time
// zone, so format them in UTC to avoid shifting the day.
export function formatExamDate(date: string, opts?: { withYear?: boolean }) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: opts?.withYear ? "numeric" : undefined,
    timeZone: "UTC",
  }).formatToParts(new Date(`${date}T00:00:00Z`));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;

  // "Thu 1 Oct" or "Thu 1 Oct 2026"
  return [get("weekday"), get("day"), get("month"), get("year")].filter(Boolean).join(" ");
}

// "13:00:00" -> "13:00"
export function formatTime(time: string) {
  return time.slice(0, 5);
}

export function formatTimeRange(start: string, end: string | null) {
  return end ? `${formatTime(start)}–${formatTime(end)}` : formatTime(start);
}

// Today's date as YYYY-MM-DD in the server's local time zone.
export function todayISODate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// "Exam Hall (56 seats)"
export function roomLabel(name: string, seatCount: number) {
  return `${name} (${seatCount} ${seatCount === 1 ? "seat" : "seats"})`;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
