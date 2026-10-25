"use client";

import { startTransition, useEffect, useOptimistic, useState } from "react";
import { courseColor } from "@/lib/exams";
import { seatRows, type Gender, type SeatInput } from "@/lib/seating";
import { moveStudent } from "../actions";

export type SeatOccupant = {
  studentId: string;
  name: string;
  studentNumber: string;
  gender: Gender | null;
  courseCode: string;
  courseIndex: number;
};

// Colour shows the course, so gender gets a letter in the seat's corner.
const GENDER_MARKS: Record<Gender, { letter: string; label: string; color: string }> = {
  male: { letter: "M", label: "Male", color: "#1d4ed8" },
  female: { letter: "F", label: "Female", color: "#db2777" },
};

// "Mohammed Alqahtani" -> "M. Alqahtani"
function shortName(fullName: string) {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  return rest.length ? `${first[0]}. ${rest.join(" ")}` : first;
}

// Moves the student on one seat to another, swapping if it's taken.
function applyMove(
  occupants: Map<string, SeatOccupant>,
  { fromSeatId, toSeatId }: { fromSeatId: string; toSeatId: string },
) {
  const next = new Map(occupants);
  const moving = next.get(fromSeatId);
  const other = next.get(toSeatId);
  if (!moving) return occupants;
  if (other) next.set(fromSeatId, other);
  else next.delete(fromSeatId);
  next.set(toSeatId, moving);
  return next;
}

// The room's seats, front row at the top. When movable, the instructor can
// move a student to an empty seat, or swap them with another student, either
// by dragging (mouse) or by tapping the student and then the seat (touch
// screens and keyboard). No seating rules apply to moves.
export function SeatMap({
  examId,
  seats,
  occupants,
  movable,
}: {
  examId: string;
  seats: SeatInput[];
  occupants: Map<string, SeatOccupant>;
  movable: boolean;
}) {
  // Moves show straight away; the page catches up once they're saved.
  const [shown, showMove] = useOptimistic(occupants, applyMove);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  // The seat of the student picked up by tapping, waiting for a seat to go to.
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const columns = Math.max(...seats.map((s) => s.col)) + 1;
  const rows = seatRows(seats);
  const selectedStudent = selected ? shown.get(selected) : null;

  // Escape puts a tapped student back down.
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  function move(fromSeatId: string, toSeatId: string) {
    const moving = shown.get(fromSeatId);
    if (!moving || fromSeatId === toSeatId) return;

    startTransition(async () => {
      showMove({ fromSeatId, toSeatId });
      const result = await moveStudent(examId, moving.studentId, toSeatId);
      setError(result.error);
    });
  }

  function drop(toSeatId: string) {
    const fromSeatId = dragFrom;
    setDragFrom(null);
    setDropTarget(null);
    if (fromSeatId) move(fromSeatId, toSeatId);
  }

  // First tap picks a student up, the next tap places them: on an empty seat
  // they move, on another student they swap. Tapping them again cancels.
  function tap(seatId: string) {
    if (selected === null) {
      if (shown.has(seatId)) setSelected(seatId);
      return;
    }
    setSelected(null);
    move(selected, seatId);
  }

  return (
    <div>
      {movable &&
        (selectedStudent ? (
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <p aria-live="polite">
              Moving <span className="font-medium">{selectedStudent.name}</span>. Tap a seat to
              place them there, or another student to swap.
            </p>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-muted underline underline-offset-2 hover:text-ink"
            >
              Cancel
            </button>
          </div>
        ) : (
          <p className="mb-3 text-sm text-muted">
            Drag a student to another seat, or tap a student and then tap where they should go.
            Placing them on another student swaps the two.
          </p>
        ))}
      {error && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <div style={{ minWidth: `${columns * 5.5}rem` }}>
          <div className="mb-4 border-b-2 border-ink/70 pb-1.5 text-center text-xs tracking-wide text-muted uppercase">
            Front
          </div>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {rows.flatMap((row, r) =>
              row.map((seat) => {
                const occupant = shown.get(seat.id);
                const color = occupant ? courseColor(occupant.courseIndex) : null;
                const mark = occupant?.gender ? GENDER_MARKS[occupant.gender] : null;
                const isDropTarget = dropTarget === seat.id && dragFrom !== seat.id;
                const isSelected = selected === seat.id;
                // A button when students can be moved, so taps and the keyboard work.
                const Cell = movable ? "button" : "div";
                return (
                  <Cell
                    key={seat.id}
                    type={movable ? "button" : undefined}
                    aria-pressed={movable && occupant ? isSelected : undefined}
                    onClick={movable ? () => tap(seat.id) : undefined}
                    title={
                      occupant
                        ? `${seat.code}: ${occupant.name} (${occupant.studentNumber}), ${occupant.courseCode}${mark ? `, ${mark.label.toLowerCase()}` : ""}`
                        : `${seat.code}: empty`
                    }
                    draggable={movable && !!occupant}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      // Firefox only starts a drag if some data is set.
                      e.dataTransfer.setData("text/plain", seat.id);
                      setSelected(null);
                      setDragFrom(seat.id);
                    }}
                    onDragEnd={() => {
                      setDragFrom(null);
                      setDropTarget(null);
                    }}
                    onDragOver={(e) => {
                      if (!movable || !dragFrom) return;
                      e.preventDefault(); // allows dropping here
                      e.dataTransfer.dropEffect = "move";
                      if (dropTarget !== seat.id) setDropTarget(seat.id);
                    }}
                    onDragLeave={() => {
                      if (dropTarget === seat.id) setDropTarget(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      drop(seat.id);
                    }}
                    className={`block min-w-0 rounded-[4px] border px-2 py-1.5 text-left transition-shadow ${
                      occupant ? "" : "border-dashed border-line"
                    } ${movable && occupant ? "cursor-grab active:cursor-grabbing" : ""} ${
                      // While a student is picked up, every other seat is a place to tap.
                      selected && !isSelected ? "cursor-pointer hover:ring-1 hover:ring-accent" : ""
                    } ${dragFrom === seat.id ? "opacity-40" : ""} ${
                      isDropTarget || isSelected
                        ? "ring-2 ring-accent ring-offset-1 ring-offset-paper"
                        : ""
                    } focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none`}
                    style={{
                      gridRow: r + 1,
                      gridColumn: seat.col + 1,
                      ...(color && {
                        backgroundColor: color.bg,
                        borderColor: color.border,
                        color: color.text,
                      }),
                    }}
                  >
                    <span className="flex items-center justify-between gap-1 leading-4">
                      <span
                        className={`font-mono text-[11px] ${occupant ? "opacity-70" : "text-faint"}`}
                      >
                        {seat.code}
                      </span>
                      {mark && (
                        <span
                          aria-label={mark.label}
                          className="text-[11px] font-semibold"
                          style={{ color: mark.color }}
                        >
                          {mark.letter}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[13px] leading-5">
                      {occupant ? shortName(occupant.name) : " "}
                    </span>
                  </Cell>
                );
              }),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
