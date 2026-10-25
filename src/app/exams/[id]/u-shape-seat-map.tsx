import { courseColor } from "@/lib/exams";
import type { Gender, SeatInput } from "@/lib/seating";
import type { SeatOccupant } from "./seat-map";

// BG-68: algosaibi room, horseshoe that is open at the bottom. Two concentric table
// rings (outer: seats 1-33, inner: 34-52, which only covers the top and
// upper arms -- see the migration for why), a 3x5 block of fill-in seats
// and a 4-seat head row facing the opening, and two small side tables
// hanging off the open ends. This draws straight from each seat's code (its
// real printed number), not from row_index/column_index -- same approach as
// the auditorium map, for the same reason: those numbers are bookkeeping
// for the algorithm (fill order, and a left/right split for male/female
// separation), not a picture of the room.
const CX = 500;
const CY = 430;

function polar(angleDeg: number, radius: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(a), y: CY - radius * Math.sin(a) };
}

// Seats walked in physical order around the table, evenly spaced from
// startDeg sweeping counter-clockwise (increasing angle) across sweepDeg.
function arc(codes: string[], startDeg: number, sweepDeg: number, radius: number) {
  const n = codes.length;
  const points = new Map<string, { x: number; y: number }>();
  codes.forEach((code, i) => {
    const angle = startDeg + (sweepDeg * i) / (n - 1);
    points.set(code, polar(angle, radius));
  });
  return points;
}

const OUTER_RING = [
  "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22",
  "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33",
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11",
];
const INNER_RING = ["47", "48", "49", "50", "51", "52", "40", "41", "42", "43", "44", "45", "46", "34", "35", "36", "37", "38", "39"];
const LEFT_WING = ["72", "73", "74", "75"];
const RIGHT_WING = ["68", "69", "70", "71"];
const HEAD_ROW: [string, number][] = [
  ["79", -105],
  ["78", -35],
  ["77", 35],
  ["76", 105],
];
const BLOCK_COLS: [string, string, string][] = [
  ["55", "54", "53"],
  ["56", "65", "64"],
  ["57", "66", "63"],
  ["58", "67", "62"],
  ["59", "60", "61"],
];

function positions() {
  const points = new Map<string, { x: number; y: number }>();
  for (const [code, p] of arc(OUTER_RING, 320, 260, 400)) points.set(code, p);
  for (const [code, p] of arc(INNER_RING, 345, 210, 280)) points.set(code, p);
  for (const [code, p] of arc(LEFT_WING, 150, 28, 490)) points.set(code, p);
  for (const [code, p] of arc(RIGHT_WING, 2, 28, 490)) points.set(code, p);
  for (const [code, dx] of HEAD_ROW) points.set(code, { x: CX + dx, y: CY + 130 });
  BLOCK_COLS.forEach(([left, center, right], row) => {
    const y = CY + 195 + row * 48;
    points.set(left, { x: CX - 95, y });
    points.set(center, { x: CX, y });
    points.set(right, { x: CX + 95, y });
  });
  return points;
}

const GENDER_MARKS: Record<Gender, { letter: string; color: string }> = {
  male: { letter: "M", color: "#1d4ed8" },
  female: { letter: "F", color: "#db2777" },
};

export function UShapeSeatMap({
  seats,
  occupants,
}: {
  seats: SeatInput[];
  occupants: Map<string, SeatOccupant>;
}) {
  const points = positions();
  const byCode = new Map(seats.map((s) => [s.code, s]));

  return (
    <div className="overflow-x-auto">
      <div className="relative mx-auto" style={{ width: 1000, height: 880 }}>
        <div className="absolute inset-x-0 bottom-10 text-center text-xs tracking-wide text-muted uppercase">
          Opening
        </div>
        {[...points.entries()].map(([code, { x, y }]) => {
          const seat = byCode.get(code);
          if (!seat) return null;
          return (
            <div key={seat.id} className="absolute" style={{ left: x - 15, top: y - 15 }}>
              <USeatCell seat={seat} occupant={occupants.get(seat.id)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function USeatCell({ seat, occupant }: { seat: SeatInput; occupant?: SeatOccupant }) {
  const color = occupant ? courseColor(occupant.courseIndex) : null;
  const mark = occupant?.gender ? GENDER_MARKS[occupant.gender] : null;
  return (
    <div
      title={
        occupant
          ? `${seat.code}: ${occupant.name} (${occupant.studentNumber}), ${occupant.courseCode}`
          : `${seat.code}: empty`
      }
      className={`relative flex size-[30px] items-center justify-center whitespace-nowrap rounded-full border text-[10px] leading-none ${
        occupant ? "opacity-80" : "border-dashed border-line text-faint"
      }`}
      style={color ? { backgroundColor: color.bg, borderColor: color.border, color: color.text } : undefined}
    >
      {seat.code}
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