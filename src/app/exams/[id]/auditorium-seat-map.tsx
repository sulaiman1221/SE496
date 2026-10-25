import { courseColor } from "@/lib/exams";
import type { Gender, SeatInput } from "@/lib/seating";
import type { SeatOccupant } from "./seat-map";

// Princess Haya Auditorium:
// The outer section of each tier (1, 9 at the front; 4, 12 at the back) is
// an angled end wedge; the rest are straight. Seat codes are laid out by the
// migration as "<section>-<row>-<seat>", which is what this component reads
// to figure out where each seat sits -- row_index/column_index (used by the
// seating algorithm) only encode front-to-back fill order and a left/right
// split for the generator's male/female separation, not this room's actual
// visual shape.
const SECTION_LAYOUT: { section: string; tier: "front" | "back"; order: number; angled: boolean }[] = [
  { section: "1", tier: "front", order: 0, angled: true },
  { section: "2", tier: "front", order: 1, angled: false },
  { section: "3", tier: "front", order: 2, angled: false },
  { section: "7", tier: "front", order: 3, angled: false },
  { section: "8", tier: "front", order: 4, angled: false },
  { section: "9", tier: "front", order: 5, angled: true },
  { section: "4", tier: "back", order: 0, angled: true },
  { section: "5", tier: "back", order: 1, angled: false },
  { section: "6", tier: "back", order: 2, angled: false },
  { section: "10", tier: "back", order: 3, angled: false },
  { section: "11", tier: "back", order: 4, angled: false },
  { section: "12", tier: "back", order: 5, angled: true },
];

const SEAT_CODE_RE = /^(\d+)-(\d+)-(\d+)$/;

const GENDER_MARKS: Record<Gender, { letter: string; color: string }> = {
  male: { letter: "M", color: "#1d4ed8" },
  female: { letter: "F", color: "#db2777" },
};

type SectionCell = { row: number; col: number; seat: SeatInput };

export function AuditoriumSeatMap({
  seats,
  occupants,
}: {
  seats: SeatInput[];
  occupants: Map<string, SeatOccupant>;
}) {
  const bySection = new Map<string, SectionCell[]>();
  for (const seat of seats) {
    const m = SEAT_CODE_RE.exec(seat.code);
    if (!m) continue;
    const [, section, row, col] = m;
    const cells = bySection.get(section) ?? [];
    cells.push({ row: Number(row), col: Number(col), seat });
    bySection.set(section, cells);
  }

  return (
    <div className="overflow-x-auto">
      <div className="mb-6 min-w-[64rem] border-b-2 border-ink/70 pb-1.5 text-center text-xs tracking-wide text-muted uppercase">
        Stage
      </div>
      <div className="flex min-w-[64rem] flex-col items-center gap-12">
        {(["front", "back"] as const).map((tier) => (
          <div key={tier} className="flex items-start justify-center gap-5">
            {SECTION_LAYOUT.filter((s) => s.tier === tier)
              .sort((a, b) => a.order - b.order)
              .map((s) => (
                <div key={s.section} className={s.order === 3 ? "ml-10" : undefined}>
                  <SectionBlock
                    section={s.section}
                    cells={bySection.get(s.section) ?? []}
                    occupants={occupants}
                    angleDeg={s.angled ? (s.order < 3 ? -7 : 7) : 0}
                  />
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionBlock({
  section,
  cells,
  occupants,
  angleDeg,
}: {
  section: string;
  cells: SectionCell[];
  occupants: Map<string, SeatOccupant>;
  angleDeg: number;
}) {
  const columns = Math.max(1, ...cells.map((c) => c.col));

  return (
    <div
      className="flex flex-col items-center gap-1"
      style={angleDeg ? { transform: `rotate(${angleDeg}deg)` } : undefined}
    >
      <div className="text-xs font-medium text-muted">{section}</div>
      <div
        className="grid gap-1 rounded-[6px] border border-line p-1.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {cells.map(({ row, col, seat }) => (
          <div key={seat.id} style={{ gridRow: row, gridColumn: col }}>
            <SeatCell seat={seat} occupant={occupants.get(seat.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// 972 seats across 12 sections leaves no room per cell for a code + name
// (see SeatMap's own cell in seat-map.tsx) -- just the seat's position in
// its row, coloured by course, with a small M/F mark like the plain grid
// map. Full details are in the tooltip and the student table below.
function SeatCell({ seat, occupant }: { seat: SeatInput; occupant?: SeatOccupant }) {
  const color = occupant ? courseColor(occupant.courseIndex) : null;
  const mark = occupant?.gender ? GENDER_MARKS[occupant.gender] : null;
  const seatNumber = seat.code.split("-").at(-1);
  return (
    <div
      title={
        occupant
          ? `${seat.code}: ${occupant.name} (${occupant.studentNumber}), ${occupant.courseCode}`
          : `${seat.code}: empty`
      }
      className={`relative flex size-6 items-center justify-center whitespace-nowrap rounded-[3px] border text-[10px] leading-none ${
        occupant ? "opacity-80" : "border-dashed border-line text-faint"
      }`}
      style={
        color ? { backgroundColor: color.bg, borderColor: color.border, color: color.text } : undefined
      }
    >
      {seatNumber}
      {mark && (
        <span
          aria-hidden
          className="absolute -top-1.5 -right-1.5 text-[9px] font-bold"
          style={{ color: mark.color }}
        >
          {mark.letter}
        </span>
      )}
    </div>
  );
}