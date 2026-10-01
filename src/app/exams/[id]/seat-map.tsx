import { courseColor } from "@/lib/exams";
import { seatRows, type SeatInput } from "@/lib/seating";

export type SeatOccupant = {
  name: string;
  studentNumber: string;
  courseCode: string;
  courseIndex: number;
};

// "Mohammed Alqahtani" -> "M. Alqahtani"
function shortName(fullName: string) {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  return rest.length ? `${first[0]}. ${rest.join(" ")}` : first;
}

export function SeatMap({
  seats,
  occupants,
}: {
  seats: SeatInput[];
  occupants: Map<string, SeatOccupant>;
}) {
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
              const occupant = occupants.get(seat.id);
              const color = occupant ? courseColor(occupant.courseIndex) : null;
              return (
                <div
                  key={seat.id}
                  title={
                    occupant
                      ? `${seat.code}: ${occupant.name} (${occupant.studentNumber}), ${occupant.courseCode}`
                      : `${seat.code}: empty`
                  }
                  className={`min-w-0 rounded-[4px] border px-2 py-1.5 ${
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
                  <div
                    className={`font-mono text-[11px] leading-4 ${occupant ? "opacity-70" : "text-faint"}`}
                  >
                    {seat.code}
                  </div>
                  <div className="truncate text-[13px] leading-5">
                    {occupant ? shortName(occupant.name) : " "}
                  </div>
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
