"use client";

import { startTransition, useOptimistic, useState } from "react";
import { setFrontRow } from "../actions";

export type StudentRow = {
  studentId: string;
  name: string;
  studentNumber: string;
  courseCode: string;
  // Null until a plan is generated.
  seatCode: string | null;
  frontRow: boolean;
  email: { status: string; error: string | null } | null;
};

const EMAIL_STATUS_LABELS: Record<string, string> = {
  sent: "Sent",
  failed: "Failed",
  skipped: "Skipped",
};

// Every student in the exam, searchable by name or ID. Before approval the
// instructor can mark students for the front row; after approval it shows
// whether each student was emailed their seat.
export function StudentTable({
  examId,
  rows,
  editable,
  showEmail,
}: {
  examId: string;
  rows: StudentRow[];
  editable: boolean;
  showEmail: boolean;
}) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Ticks show straight away; the page catches up once the change is saved.
  const [frontRow, setOptimisticFrontRow] = useOptimistic(
    new Set(rows.filter((r) => r.frontRow).map((r) => r.studentId)),
    (current, change: { studentId: string; on: boolean }) => {
      const next = new Set(current);
      if (change.on) next.add(change.studentId);
      else next.delete(change.studentId);
      return next;
    },
  );

  const q = query.trim().toLowerCase();
  const shown = q
    ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.studentNumber.includes(q))
    : rows;

  function toggle(studentId: string, on: boolean) {
    startTransition(async () => {
      setOptimisticFrontRow({ studentId, on });
      const result = await setFrontRow(examId, studentId, on);
      setError(result.error);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or ID"
          aria-label="Search students"
          className="w-full max-w-xs rounded-[5px] border border-line bg-surface px-3 py-1.5 text-sm outline-none transition-colors focus:border-accent"
        />
        <p className="text-sm text-muted tabular-nums">
          {q ? `${shown.length} of ${rows.length} students` : `${rows.length} students`}
          {editable && frontRow.size > 0 && ` · ${frontRow.size} in the front row`}
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      <table className="mt-3 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-muted">
            <th className="py-2 pr-4 font-normal">Seat</th>
            <th className="py-2 pr-4 font-normal">Student</th>
            <th className="py-2 pr-4 font-normal">ID</th>
            <th className="py-2 pr-4 font-normal">Course</th>
            {editable && <th className="py-2 font-normal">Front row</th>}
            {showEmail && <th className="py-2 font-normal">Email</th>}
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={row.studentId} className="border-b border-line">
              <td className="py-2 pr-4 font-mono text-[13px]">
                {row.seatCode ?? <span className="text-faint">—</span>}
              </td>
              <td className="py-2 pr-4">{row.name}</td>
              <td className="py-2 pr-4 tabular-nums text-muted">{row.studentNumber}</td>
              <td className="py-2 pr-4 font-mono text-[13px]">{row.courseCode}</td>
              {editable && (
                <td className="py-2">
                  <input
                    type="checkbox"
                    checked={frontRow.has(row.studentId)}
                    onChange={(e) => toggle(row.studentId, e.target.checked)}
                    aria-label={`Front row for ${row.name}`}
                    className="accent-accent"
                  />
                </td>
              )}
              {showEmail && (
                <td
                  title={row.email?.error ?? undefined}
                  className={
                    row.email?.status === "failed"
                      ? "py-2 text-danger"
                      : row.email?.status === "sent"
                        ? "py-2"
                        : "py-2 text-muted"
                  }
                >
                  {row.email
                    ? (EMAIL_STATUS_LABELS[row.email.status] ?? row.email.status)
                    : "Not sent"}
                </td>
              )}
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-muted">
                No students match “{query.trim()}”.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
