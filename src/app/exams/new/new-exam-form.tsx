"use client";

import { startTransition, useActionState, useState } from "react";
import { roomLabel } from "@/lib/exams";
import type { CourseOption, RoomOption } from "@/lib/queries";
import { createExam, type CreateExamState } from "../actions";

const initialState: CreateExamState = { error: null };

const inputClass =
  "rounded-[5px] border border-line bg-white px-3 py-2 text-[15px] outline-none transition-colors focus:border-accent";

export function NewExamForm({
  courses,
  rooms,
  today,
}: {
  courses: CourseOption[];
  rooms: RoomOption[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState(createExam, initialState);

  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [examDate, setExamDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [title, setTitle] = useState("");

  // A student enrolled in two selected courses still needs only one seat.
  const studentCount = new Set(
    courses.filter((c) => courseIds.includes(c.id)).flatMap((c) => c.studentIds),
  ).size;

  const fits = (room: RoomOption) => room.seatCount >= studentCount;
  const selectedRoom = rooms.find((r) => r.id === roomId && fits(r)) ?? null;

  const canSubmit =
    courseIds.length > 0 && studentCount > 0 && selectedRoom && examDate && startTime && !pending;

  function toggleCourse(id: string) {
    setCourseIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  // Submit manually rather than via <form action>, which resets the form after
  // the action and would clear the fields when the server returns an error.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 max-w-2xl">
      <Section title="Courses">
        {courses.length === 0 ? (
          <p className="text-muted">No courses found.</p>
        ) : (
          <ul>
            {courses.map((course) => (
              <li key={course.id}>
                <label className="-mx-3 grid cursor-pointer grid-cols-[auto_4.5rem_1fr_auto] items-baseline gap-x-3 rounded-[5px] px-3 py-2 hover:bg-hover">
                  <input
                    type="checkbox"
                    name="courseId"
                    value={course.id}
                    checked={courseIds.includes(course.id)}
                    onChange={() => toggleCourse(course.id)}
                    className="translate-y-[2px] accent-accent"
                  />
                  <span className="font-mono text-[13px]">{course.code}</span>
                  <span className="min-w-0 truncate">{course.name}</span>
                  <span className="text-sm text-muted tabular-nums">
                    {course.studentIds.length}{" "}
                    {course.studentIds.length === 1 ? "student" : "students"}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Room">
        {rooms.length === 0 ? (
          <p className="text-muted">No rooms found.</p>
        ) : (
          <ul>
            {rooms.map((room) => {
              const tooSmall = !fits(room);
              return (
                <li key={room.id}>
                  <label
                    className={`-mx-3 grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 rounded-[5px] px-3 py-2 ${
                      tooSmall ? "cursor-not-allowed text-faint" : "cursor-pointer hover:bg-hover"
                    }`}
                  >
                    <input
                      type="radio"
                      name="roomId"
                      value={room.id}
                      checked={selectedRoom?.id === room.id}
                      onChange={() => setRoomId(room.id)}
                      disabled={tooSmall}
                      className="translate-y-[2px] accent-accent"
                    />
                    <span>{roomLabel(room.name, room.seatCount)}</span>
                    <span className="text-sm">{tooSmall && "Too small"}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Date and time">
        <div className="flex flex-wrap gap-4">
          <Field label="Date">
            <input
              type="date"
              name="examDate"
              min={today}
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Start">
            <input
              type="time"
              name="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="End">
            <input
              type="time"
              name="endTime"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      <Section title="Name" hint="Optional, e.g. Midterm or Final">
        <input
          type="text"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          className={`${inputClass} w-full max-w-sm`}
        />
      </Section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        <p className="text-muted tabular-nums">
          {courseIds.length === 0
            ? "No courses selected"
            : `${studentCount} ${studentCount === 1 ? "student" : "students"}${
                selectedRoom ? `, ${selectedRoom.seatCount} seats` : ""
              }`}
        </p>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-[5px] bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-faint"
        >
          {pending ? "Creating…" : "Create exam"}
        </button>
      </div>

      {state.error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line py-6 first:border-t-0 first:pt-0">
      <h2 className="mb-3 text-sm font-medium">
        {title}
        {hint && <span className="ml-2 font-normal text-faint">{hint}</span>}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}
