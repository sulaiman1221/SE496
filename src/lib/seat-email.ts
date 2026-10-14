import { formatExamDate, formatTimeRange } from "@/lib/exams";

export type SeatEmailDetails = {
  studentName: string;
  examTitle: string;
  courseCode: string;
  courseName: string;
  examDate: string;
  startTime: string;
  endTime: string | null;
  roomName: string;
  seatCode: string;
};

// Domains reserved for examples and testing (RFC 2606). The demo students use
// them, and mail to them would only bounce back to the sending mailbox.
const TEST_DOMAINS = ["example.com", "example.org", "example.net"];
const TEST_TLDS = [".example", ".test", ".invalid", ".localhost"];

export function isTestAddress(email: string) {
  const domain = email.split("@").pop()?.trim().toLowerCase() ?? "";
  return TEST_DOMAINS.includes(domain) || TEST_TLDS.some((tld) => domain.endsWith(tld));
}

export function seatEmail(d: SeatEmailDetails) {
  const date = formatExamDate(d.examDate, { withYear: true });
  const time = formatTimeRange(d.startTime, d.endTime);
  const subject = `Your exam seat: ${d.seatCode} (${d.courseCode}, ${formatExamDate(d.examDate)})`;

  const rows: [string, string][] = [
    ["Course", `${d.courseCode} ${d.courseName}`],
    ["Date", date],
    ["Time", time],
    ["Room", d.roomName],
  ];

  const html = `<div style="font-family: Segoe UI, Arial, sans-serif; font-size: 15px; color: #1a1a1a; line-height: 1.5">
  <p>Hi ${escapeHtml(d.studentName)},</p>
  <p>Here is your seat for ${escapeHtml(d.examTitle)}.</p>
  <p style="margin: 24px 0; font-size: 13px; color: #555">Your seat<br>
    <span style="font-size: 32px; font-weight: 600; color: #1a1a1a; letter-spacing: 0.02em">${escapeHtml(d.seatCode)}</span>
  </p>
  <table cellpadding="0" cellspacing="0" style="border-collapse: collapse">
    ${rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding: 4px 24px 4px 0; color: #555">${label}</td><td style="padding: 4px 0">${escapeHtml(value)}</td></tr>`,
      )
      .join("\n    ")}
  </table>
  <p style="margin-top: 24px">Sit in this seat and tap your student ID card on the reader at the seat to check in.</p>
  <p style="margin-top: 32px; font-size: 13px; color: #777">This email was sent by the SE496 Exam Seating system.</p>
</div>`;

  return { subject, html };
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
