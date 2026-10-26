"use client";

import { courseColor } from "@/lib/exams";
import { seatRows, type SeatInput } from "@/lib/seating";
import { AuditoriumLayout } from "./auditorium-seat-map";
import {
  GenderMark,
  MoveHint,
  Seat,
  useSeatMoves,
  type SeatMoves,
  type SeatOccupant,
} from "./seat-moves";
import { UShapeLayout } from "./u-shape-seat-map";

export type { SeatOccupant };

// "Mohammed Alqahtani" -> "M. Alqahtani"
function shortName(fullName: string) {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  return rest.length ? `${first[0]}. ${rest.join(" ")}` : first;
}

// The room's seats, drawn the way the room is laid out (rooms.layout_type):
// the auditorium's angled sections, BG-68's U shape, or a plain grid for
// everything else. When movable, the instructor can drag or tap students to
// other seats in any of them.
export function SeatMap({
  examId,
  layout,
  seats,
  occupants,
  movable,
}: {
  examId: string;
  layout: string;
  seats: SeatInput[];
  occupants: Map<string, SeatOccupant>;
  movable: boolean;
}) {
  const moves = useSeatMoves({ examId, occupants, movable });

  return (
    <div>
      <MoveHint moves={moves} />
      {layout === "fan_auditorium" ? (
        <AuditoriumLayout seats={seats} moves={moves} />
      ) : layout === "u_shape" ? (
        <UShapeLayout seats={seats} moves={moves} />
      ) : (
        <GridLayout seats={seats} moves={moves} />
      )}
    </div>
  );
}

// Rows and columns from the seats' row and column numbers, front at the top.
function GridLayout({ seats, moves }: { seats: SeatInput[]; moves: SeatMoves }) {
  const columns = Math.max(...seats.map((s) => s.col)) + 1;
  const rows = seatRows(seats);

  return (
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
              const occupant = moves.shown.get(seat.id);
              const color = occupant ? courseColor(occupant.courseIndex) : null;
              return (
                <Seat
                  key={seat.id}
                  moves={moves}
                  seat={seat}
                  className={`block min-w-0 rounded-[4px] border px-2 py-1.5 text-left ${
                    occupant ? "" : "border-dashed border-line"
                  }`}
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
                    <GenderMark
                      gender={occupant?.gender ?? null}
                      className="text-[11px] font-semibold"
                    />
                  </span>
                  <span className="block truncate text-[13px] leading-5">
                    {occupant ? shortName(occupant.name) : " "}
                  </span>
                </Seat>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
