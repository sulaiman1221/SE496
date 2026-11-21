"use client";

import { startTransition, useActionState, useState } from "react";
import { roomLabel } from "@/lib/exams";
import type { RoomOption } from "@/lib/queries";
import { completeExam, createMakeupExam, type ExamActionState } from "../actions";

const initialState: ExamActionState = { error: null };

const primaryButton =
  "rounded-[5px] bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-faint";
const secondaryButton =
  "rounded-[5px] border border-line bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:text-faint";
const inputClass =
  "rounded-[5px] border border-line bg-surface px-3 py-2 text-[15px] outline-none transition-colors focus:border-accent";

// "Complete exam", with a confirm step: it closes check-in for good.
export function CompleteExamButton({ examId }: { examId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, complete, pending] = useActionState(() => completeExam(examId), initialState);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={secondaryButton}>
        Complete exam
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span>End check-in? Students without a check-in will be marked absent.</span>
      <button
        type="button"
        onClick={() => startTransition(complete)}
        disabled={pending}
        className={primaryButton}
      >
        {pending ? "Completing…" : "Yes, complete"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="text-muted underline underline-offset-2 hover:text-ink"
      >
        Cancel
      </button>
      {state.error && (
        <span role="alert" className="text-danger">
          {state.error}
        </span>
      )}
    </div>
  );
}

export type AbsentStudent = {
  studentId: string;
  name: string;
  studentNumber: string;
  courseCode: string;
  seatCode: string;
  // Already put in an earlier makeup exam for this exam.
  inMakeup: boolean;
};

// The students who missed the exam, ticked by default (except anyone already
// in a makeup), and the room and time for their makeup exam.
export function MakeupForm({
  examId,
  absent,
  rooms,
  defaults,
  today,
}: {
  examId: string;
  absent: AbsentStudent[];
  rooms: RoomOption[];
  defaults: { date: string; startTime: string; endTime: string };
  today: string;
}) {
  const [state, formAction, pending] = useActionState(
    createMakeupExam.bind(null, examId),
    initialState,
  );
  const [selected, setSelected] = useState(
    () => new Set(absent.filter((s) => !s.inMakeup).map((s) => s.studentId)),
  );
  const [roomId, setRoomId] = useState("");
  const [examDate, setExamDate] = useState(defaults.date);
  const [startTime, setStartTime] = useState(defaults.startTime);
  const [endTime, setEndTime] = useState(defaults.endTime);

  const fits = (room: RoomOption) => room.seatCount >= selected.size;
  const selectedRoom = rooms.find((r) => r.id === roomId && fits(r)) ?? null;
  const canSubmit = selected.size > 0 && selectedRoom && examDate && startTime && !pending;

  function toggle(studentId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  // Submit manually rather than via <form action>, which resets the form after
  // the action and would clear the choices when the server returns an error.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-muted">
            <th className="w-8 py-2 font-normal">
              <span className="sr-only">Include</span>
            </th>
            <th className="py-2 pr-4 font-normal">Student</th>
            <th className="py-2 pr-4 font-normal">ID</th>
            <th className="py-2 pr-4 font-normal">Course</th>
            <th className="py-2 font-normal">Seat</th>
          </tr>
        </thead>
        <tbody>
          {absent.map((s) => (
            <tr key={s.studentId} className="border-b border-line">
              <td className="py-2">
                <input
                  type="checkbox"
                  name="studentId"
                  value={s.studentId}
                  checked={selected.has(s.studentId)}
                  onChange={() => toggle(s.studentId)}
                  aria-label={`Include ${s.name} in the makeup exam`}
                  className="accent-accent"
                />
              </td>
              <td className="py-2 pr-4">
                {s.name}
                {s.inMakeup && <span className="ml-2 text-xs text-muted">Already in a makeup</span>}
              </td>
              <td className="py-2 pr-4 tabular-nums text-muted">{s.studentNumber}</td>
              <td className="py-2 pr-4 font-mono text-[13px]">{s.courseCode}</td>
              <td className="py-2 font-mono text-[13px]">{s.seatCode}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Room</span>
          <select
            name="roomId"
            value={selectedRoom?.id ?? ""}
            onChange={(e) => setRoomId(e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Choose a room
            </option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id} disabled={!fits(room)}>
                {roomLabel(room.name, room.seatCount)}
                {fits(room) ? "" : " - too small"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Date</span>
          <input
            type="date"
            name="examDate"
            min={today}
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Start</span>
          <input
            type="time"
            name="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">End</span>
          <input
            type="time"
            name="endTime"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!canSubmit} className={primaryButton}>
          {pending
            ? "Creating…"
            : `Create makeup exam (${selected.size} ${selected.size === 1 ? "student" : "students"})`}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
