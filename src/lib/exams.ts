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

export function statusLabel(status: string) {
  return STATUS_LABELS[status as ExamStatus] ?? status;
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

const pad = (n: number) => String(n).padStart(2, "0");

// A date as YYYY-MM-DD in the server's local time zone.
function isoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISODate() {
  return isoDate(new Date());
}

// What the new exam form starts with: tomorrow at the current time, one hour
// long. An exam can't run past midnight, so a late start ends at 23:59.
export function newExamDefaults(now = new Date()) {
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const [hour, minute] = [now.getHours(), now.getMinutes()];

  return {
    date: isoDate(tomorrow),
    startTime: `${pad(hour)}:${pad(minute)}`,
    endTime: hour < 23 ? `${pad(hour + 1)}:${pad(minute)}` : "23:59",
  };
}

// "Exam Hall (56 seats)"
export function roomLabel(name: string, seatCount: number) {
  return `${name} (${seatCount} ${seatCount === 1 ? "seat" : "seats"})`;
}

// Muted colours for telling courses apart on the seat map, in course order.
export const COURSE_COLORS = [
  { bg: "#e4eaf2", border: "#b8c6d9", text: "#1f3a5f" },
  { bg: "#f4ebd8", border: "#dcc79d", text: "#6b4f12" },
  { bg: "#e3eee6", border: "#b3cfbb", text: "#2c5a3c" },
  { bg: "#f1e4e7", border: "#d8b6be", text: "#6e2f3d" },
];

export function courseColor(index: number) {
  return COURSE_COLORS[index % COURSE_COLORS.length];
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
