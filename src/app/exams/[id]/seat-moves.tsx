"use client";

import { startTransition, useEffect, useOptimistic, useState } from "react";
import type { Gender, SeatInput } from "@/lib/seating";
import { moveStudent } from "../actions";

// Shared by every seat map layout (grid, auditorium, U shape): who sits where,
// the M/F marks, and moving students by hand, by dragging (mouse) or by
// tapping a student and then a seat (touch screens and keyboard). No seating
// rules apply to moves.

export type SeatOccupant = {
  studentId: string;
  name: string;
  studentNumber: string;
  gender: Gender | null;
  courseCode: string;
  courseIndex: number;
};

// Colour shows the course, so gender gets a letter in the seat's corner.
export const GENDER_MARKS: Record<Gender, { letter: string; label: string; color: string }> = {
  male: { letter: "M", label: "Male", color: "#1d4ed8" },
  female: { letter: "F", label: "Female", color: "#db2777" },
};

// Hover text for a seat: "B3: Ali Alhajri (1030), SE200, male".
export function seatTitle(seat: SeatInput, occupant: SeatOccupant | undefined) {
  if (!occupant) return `${seat.code}: empty`;
  const gender = occupant.gender ? `, ${GENDER_MARKS[occupant.gender].label.toLowerCase()}` : "";
  return `${seat.code}: ${occupant.name} (${occupant.studentNumber}), ${occupant.courseCode}${gender}`;
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

export type SeatMoves = ReturnType<typeof useSeatMoves>;

export function useSeatMoves({
  examId,
  occupants,
  movable,
}: {
  examId: string;
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

  return {
    movable,
    shown,
    selected,
    error,
    dragFrom,
    dropTarget,
    cancel: () => setSelected(null),
    tap,
    startDrag: (seatId: string) => {
      setSelected(null);
      setDragFrom(seatId);
    },
    endDrag: () => {
      setDragFrom(null);
      setDropTarget(null);
    },
    dragOver: (seatId: string) => setDropTarget(seatId),
    dragLeave: (seatId: string) => setDropTarget((t) => (t === seatId ? null : t)),
    drop: (seatId: string) => {
      const fromSeatId = dragFrom;
      setDragFrom(null);
      setDropTarget(null);
      if (fromSeatId) move(fromSeatId, seatId);
    },
  };
}

// The line above the map: how to move students, who's being moved, or why a
// move failed.
export function MoveHint({ moves }: { moves: SeatMoves }) {
  const selectedStudent = moves.selected ? moves.shown.get(moves.selected) : null;
  return (
    <>
      {moves.movable &&
        (selectedStudent ? (
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <p aria-live="polite">
              Moving <span className="font-medium">{selectedStudent.name}</span>. Tap a seat to
              place them there, or another student to swap.
            </p>
            <button
              type="button"
              onClick={moves.cancel}
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
      {moves.error && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {moves.error}
        </p>
      )}
    </>
  );
}

// One seat, drawn however the layout likes (its className, style and
// children). Adds moving: a button that can be dragged and tapped when
// students can be moved, a plain box otherwise.
export function Seat({
  moves,
  seat,
  className,
  style,
  children,
}: {
  moves: SeatMoves;
  seat: SeatInput;
  className: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const occupant = moves.shown.get(seat.id);
  const { movable, selected, dragFrom } = moves;
  const isSelected = selected === seat.id;
  const isDropTarget = moves.dropTarget === seat.id && dragFrom !== seat.id;
  // A button when students can be moved, so taps and the keyboard work.
  const Cell = movable ? "button" : "div";

  return (
    <Cell
      type={movable ? "button" : undefined}
      aria-pressed={movable && occupant ? isSelected : undefined}
      onClick={movable ? () => moves.tap(seat.id) : undefined}
      title={seatTitle(seat, occupant)}
      draggable={movable && !!occupant}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        // Firefox only starts a drag if some data is set.
        e.dataTransfer.setData("text/plain", seat.id);
        moves.startDrag(seat.id);
      }}
      onDragEnd={moves.endDrag}
      onDragOver={(e) => {
        if (!movable || !dragFrom) return;
        e.preventDefault(); // allows dropping here
        e.dataTransfer.dropEffect = "move";
        if (moves.dropTarget !== seat.id) moves.dragOver(seat.id);
      }}
      onDragLeave={() => moves.dragLeave(seat.id)}
      onDrop={(e) => {
        e.preventDefault();
        moves.drop(seat.id);
      }}
      className={[
        className,
        "transition-shadow focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
        movable && occupant && "cursor-grab active:cursor-grabbing",
        // While a student is picked up, every other seat is a place to tap.
        selected && !isSelected && "cursor-pointer hover:ring-1 hover:ring-accent",
        dragFrom === seat.id && "opacity-40",
        (isDropTarget || isSelected) && "ring-2 ring-accent ring-offset-1 ring-offset-paper",
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      {children}
    </Cell>
  );
}

// The small M or F in a seat's corner.
export function GenderMark({ gender, className }: { gender: Gender | null; className: string }) {
  if (!gender) return null;
  const mark = GENDER_MARKS[gender];
  return (
    <span aria-label={mark.label} className={className} style={{ color: mark.color }}>
      {mark.letter}
    </span>
  );
}
