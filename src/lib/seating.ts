// Rule-based seating plan generator.
//
// The instructor can combine any of these rules in one plan (or pick none):
//   spacing      - an empty seat between every two students in a row
//   checkerboard - like spacing, but shifted by one seat in every other row,
//                  so nobody sits beside, in front of or behind anyone. It
//                  already leaves a seat between students, so ticking spacing
//                  as well gives the same pattern.
//   rows         - an empty row between every two rows of students
//   spread       - students spread evenly over the whole room instead of
//                  filling it from the front
//   alternate    - no two students from the same course next to each other in
//                  a row; a student from another course (or an empty seat) sits
//                  in between. With spacing on, the nearest student across the
//                  empty seat is from a different course too.
//
// Separately, the order students are seated in: random, by student ID, or by
// name. Ordered seating runs from the front left to the back right.
//
// "Side by side" means consecutive seats in the same row, aisles included.
// Front/back only counts for the rows and checkerboard rules. Unless spread
// out, students fill the room from the front; leftover seats at the back stay
// empty.
//
// Male and female students always sit apart: males on the left side of the
// room, females on the right (as the seat map shows it, front at the top).
// The two sides are split as close to the middle as both groups allow, at an
// aisle or with an empty column between them, and the rules apply within
// each side. An exam with only one gender uses the whole room.
//
// Students the instructor marked for the front row (for a disability or an
// injury) are seated first, in the front-most row their side allows. If there
// are more of them than the front row holds, the rest go in the next row.

export type SeatingRule = "spacing" | "checkerboard" | "rows" | "spread" | "alternate";
export type SeatingOrder = "random" | "id" | "name";
export type Gender = "male" | "female";

// Also the order rules are listed and saved in.
export const SEATING_RULES: SeatingRule[] = ["spacing", "checkerboard", "rows", "spread", "alternate"];
export const SEATING_ORDERS: SeatingOrder[] = ["random", "id", "name"];

export const RULE_LABELS: Record<SeatingRule, string> = {
  spacing: "Empty seat between students",
  checkerboard: "Checkerboard",
  rows: "Empty row between students",
  spread: "Spread across the room",
  alternate: "Alternate courses",
};

export const ORDER_LABELS: Record<SeatingOrder, string> = {
  random: "Random order",
  id: "By student ID",
  name: "By name",
};

export type SeatInput = { id: string; code: string; row: number; col: number };
export type StudentInput = {
  id: string;
  courseId: string;
  gender: Gender;
  frontRow: boolean;
  name: string;
  studentNumber: string;
};
export type Assignment = { seatId: string; studentId: string; courseId: string };

export type SeatingResult =
  | { ok: true; assignments: Assignment[] }
  | { ok: false; error: string };

export function isSeatingRule(value: unknown): value is SeatingRule {
  return typeof value === "string" && (SEATING_RULES as string[]).includes(value);
}

export function isSeatingOrder(value: unknown): value is SeatingOrder {
  return typeof value === "string" && (SEATING_ORDERS as string[]).includes(value);
}

export function isGender(value: unknown): value is Gender {
  return value === "male" || value === "female";
}

// Known rules only, without duplicates, in SEATING_RULES order.
export function normalizeRules(values: unknown[]): SeatingRule[] {
  return SEATING_RULES.filter((rule) => values.includes(rule));
}

function constraintsObject(constraints: unknown): Record<string, unknown> | null {
  return constraints && typeof constraints === "object" && !Array.isArray(constraints)
    ? (constraints as Record<string, unknown>)
    : null;
}

// The rules a plan was generated with, from exams.seating_constraints, or
// null if no plan has been generated yet.
export function savedRules(constraints: unknown): SeatingRule[] | null {
  const saved = constraintsObject(constraints);
  if (!saved) return null;
  const { rules, rule } = saved;
  if (Array.isArray(rules)) return normalizeRules(rules);
  // Plans from before rules could be combined saved one rule, or "none".
  if (rule === "none") return [];
  if (isSeatingRule(rule)) return [rule];
  return null;
}

// The order a plan seated students in. Plans from before ordering were random.
export function savedOrder(constraints: unknown): SeatingOrder {
  const order = constraintsObject(constraints)?.order;
  return isSeatingOrder(order) ? order : "random";
}

// The students marked for the front row when the plan was generated, sorted.
// Plans from before front-row priority had none.
export function savedFrontRow(constraints: unknown): string[] {
  const frontRow = constraintsObject(constraints)?.frontRow;
  return Array.isArray(frontRow) ? frontRow.filter((id) => typeof id === "string").sort() : [];
}

// Whether the students marked for the front row now differ from the ones the
// plan was generated with, so the plan needs regenerating.
export function frontRowChanged(constraints: unknown, currentFrontRow: string[]) {
  return savedFrontRow(constraints).join() !== [...currentFrontRow].sort().join();
}

// "No rules", or the rules as one sentence: "Empty seat between students,
// alternate courses".
export function describeRules(rules: SeatingRule[]) {
  if (rules.length === 0) return "No rules";
  return rules
    .map((rule, i) => (i === 0 ? RULE_LABELS[rule] : RULE_LABELS[rule].toLowerCase()))
    .join(", ");
}

// Seats grouped into rows, front row first, each row ordered left to right.
export function seatRows(seats: SeatInput[]): SeatInput[][] {
  const byRow = new Map<number, SeatInput[]>();
  for (const seat of seats) {
    byRow.set(seat.row, [...(byRow.get(seat.row) ?? []), seat]);
  }
  return [...byRow.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, row]) => row.sort((a, b) => a.col - b.col));
}

// The spacing rules leave every other row, and every other seat in a row,
// empty, starting from the front and from the left. Checkerboard starts one
// seat further right in every other row it uses, counting only those rows.
function keepRow(index: number, rules: SeatingRule[]) {
  return !rules.includes("rows") || index % 2 === 0;
}

function keepSeat(index: number, keptRowIndex: number, rules: SeatingRule[]) {
  if (rules.includes("checkerboard")) return (index + keptRowIndex) % 2 === 0;
  return !rules.includes("spacing") || index % 2 === 0;
}

function usableRows(rows: SeatInput[][], rules: SeatingRule[]) {
  return rows
    .filter((_, i) => keepRow(i, rules))
    .map((row, k) => row.filter((_, i) => keepSeat(i, k, rules)));
}

// How many students fit once the spacing rules leave their seats empty, given
// the number of seats in each row, front row first. Alternating courses can
// fit fewer, depending on how many students each course has.
export function roomCapacity(rowSizes: number[], rules: SeatingRule[]) {
  return rowSizes
    .filter((_, i) => keepRow(i, rules))
    .reduce((sum, size, k) => {
      const kept = Array.from({ length: size }, (_, i) => i).filter((i) => keepSeat(i, k, rules));
      return sum + kept.length;
    }, 0);
}

export function generateSeating(
  seats: SeatInput[],
  students: StudentInput[],
  rules: SeatingRule[],
  { order = "random", random = Math.random }: { order?: SeatingOrder; random?: () => number } = {},
): SeatingResult {
  if (students.length === 0) {
    return { ok: false, error: "There are no students to seat." };
  }
  if (rules.includes("alternate") && new Set(students.map((s) => s.courseId)).size < 2) {
    return { ok: false, error: "Alternating courses needs at least two courses in the exam." };
  }

  const options = { rules, order, random };
  const males = students.filter((s) => s.gender === "male");
  const females = students.filter((s) => s.gender === "female");
  if (males.length === 0 || females.length === 0) return seatGroup(seats, students, options);

  for (const side of roomSplits(seats)) {
    const left = seatGroup(side.left, males, options);
    if (!left.ok) continue;
    const right = seatGroup(side.right, females, options);
    if (!right.ok) continue;
    return { ok: true, assignments: [...left.assignments, ...right.assignments] };
  }

  return {
    ok: false,
    error: `${males.length} male and ${females.length} female students don't fit on separate sides of this room${rules.length > 0 ? " with these rules" : ""}.`,
  };
}

// Ways to divide the room into a left and a right side that never sit side
// by side, closest to the middle first. A side ends at an aisle (a column
// with no seats), or else one column is left empty between the two sides.
function roomSplits(seats: SeatInput[]) {
  const columns = [...new Set(seats.map((s) => s.col))].sort((a, b) => a - b);
  const middle = (columns[0] + columns[columns.length - 1]) / 2;

  const splits: { position: number; leftEnd: number; rightStart: number; emptyColumn: boolean }[] =
    [];
  for (let i = 0; i < columns.length - 1; i++) {
    const [col, next] = [columns[i], columns[i + 1]];
    if (next - col > 1) {
      splits.push({ position: (col + next) / 2, leftEnd: col, rightStart: next, emptyColumn: false });
    }
    // Leave the next column empty, if there's still a column after it.
    if (i + 2 < columns.length) {
      splits.push({ position: next, leftEnd: col, rightStart: columns[i + 2], emptyColumn: true });
    }
  }

  return splits
    .sort(
      (a, b) =>
        Math.abs(a.position - middle) - Math.abs(b.position - middle) ||
        // At the same distance, prefer an aisle, which leaves no seats empty.
        Number(a.emptyColumn) - Number(b.emptyColumn),
    )
    .map((split) => ({
      left: seats.filter((s) => s.col <= split.leftEnd),
      right: seats.filter((s) => s.col >= split.rightStart),
    }));
}

type GroupOptions = { rules: SeatingRule[]; order: SeatingOrder; random: () => number };

// Seats one group of students in the given seats, following the rules.
function seatGroup(seats: SeatInput[], students: StudentInput[], options: GroupOptions): SeatingResult {
  const { rules, order, random } = options;
  const rows = usableRows(seatRows(seats), rules);
  const usable = rows.flat();

  if (students.length > usable.length) {
    return {
      ok: false,
      error:
        rules.length === 0
          ? `${students.length} students don't fit in a room with ${usable.length} seats.`
          : `${students.length} students don't fit with these rules. This room fits ${usable.length} that way.`,
    };
  }

  if (rules.includes("spread")) return spread(rows, students, options);
  if (rules.includes("alternate")) return alternate(rows, students, order, random);
  // Usable seats run front left to back right, so front-row students get the
  // front seats and ordered seating reads in order.
  return { ok: true, assignments: zip(usable, arrange(students, order, random)) };
}

// Students in the chosen order, everyone marked for the front row first.
function arrange(students: StudentInput[], order: SeatingOrder, random: () => number) {
  const sorted = (list: StudentInput[]) =>
    order === "random" ? shuffle(list, random) : [...list].sort(compareStudents(order));
  return [
    ...sorted(students.filter((s) => s.frontRow)),
    ...sorted(students.filter((s) => !s.frontRow)),
  ];
}

function compareStudents(order: "id" | "name") {
  const byId = (a: StudentInput, b: StudentInput) =>
    a.studentNumber.localeCompare(b.studentNumber, "en", { numeric: true });
  return order === "id"
    ? byId
    : (a: StudentInput, b: StudentInput) => a.name.localeCompare(b.name, "en") || byId(a, b);
}

// Spreads the students evenly over the usable seats instead of packing them
// into the front. Front-row students still get seats spaced along the front.
function spread(rows: SeatInput[][], students: StudentInput[], options: GroupOptions): SeatingResult {
  const { order, random } = options;
  const frontRowCount = students.filter((s) => s.frontRow).length;
  const frontFirst = (a: SeatInput, b: SeatInput) => a.row - b.row || a.col - b.col;

  if (!options.rules.includes("alternate")) {
    const picked = spreadSeats(rows, frontRowCount, students.length);
    // arrange() puts front-row students first, so they get the front-row seats.
    const seatsInOrder = [
      ...picked.slice(0, frontRowCount).sort(frontFirst),
      ...picked.slice(frontRowCount).sort(frontFirst),
    ];
    return { ok: true, assignments: zip(seatsInOrder, arrange(students, order, random)) };
  }

  // Alternating courses may need more seats than students, to leave a gap
  // where only one course is left. Find the fewest spread-out seats that work
  // (binary search, so big rooms stay fast).
  const picked = spreadSeats(rows, frontRowCount, rows.flat().length);
  const tryCount = (count: number) =>
    alternate(seatRows(picked.slice(0, count)), students, order, random);

  let best = tryCount(students.length);
  if (best.ok) return best;
  const all = tryCount(picked.length);
  if (!all.ok) return all;
  best = all;
  let [low, high] = [students.length + 1, picked.length - 1];
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const result = tryCount(mid);
    if (result.ok) {
      best = result;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return best;
}

// Picks `count` seats spread as evenly as possible: each next seat is the one
// furthest from every seat already picked, starting from the front left.
// The first `frontRowCount` seats are spaced along the front row instead.
function spreadSeats(rows: SeatInput[][], frontRowCount: number, count: number): SeatInput[] {
  const all = rows.flat();
  const picked: SeatInput[] = [];
  const isPicked = new Array<boolean>(all.length).fill(false);
  // Squared distance from each seat to the nearest picked seat.
  const nearest = new Array<number>(all.length).fill(Infinity);

  const pick = (index: number) => {
    const seat = all[index];
    picked.push(seat);
    isPicked[index] = true;
    for (let i = 0; i < all.length; i++) {
      const d = (all[i].row - seat.row) ** 2 + (all[i].col - seat.col) ** 2;
      if (d < nearest[i]) nearest[i] = d;
    }
  };

  // Front-row seats, evenly spaced along the front row, then the next row.
  let frontLeft = Math.min(frontRowCount, count);
  for (const row of rows) {
    if (frontLeft === 0) break;
    const take = Math.min(frontLeft, row.length);
    for (let j = 0; j < take; j++) {
      pick(all.indexOf(row[Math.floor(((j + 0.5) * row.length) / take)]));
    }
    frontLeft -= take;
  }

  while (picked.length < count) {
    // Ties go to the seat nearest the front left, since seats run that way.
    let best = -1;
    for (let i = 0; i < all.length; i++) {
      if (!isPicked[i] && (best === -1 || nearest[i] > nearest[best])) best = i;
    }
    pick(best);
  }
  return picked;
}

// Fills the usable seats row by row so that consecutive usable seats in a row
// never hold the same course. If only one course is left (or a side of the
// room only has one), every other seat stays empty.
function alternate(
  rows: SeatInput[][],
  students: StudentInput[],
  order: SeatingOrder,
  random: () => number,
): SeatingResult {
  // Queue of students per course, in the chosen order, front-row students at
  // the head.
  const queues = new Map<string, StudentInput[]>();
  for (const student of arrange(students, order, random)) {
    queues.set(student.courseId, [...(queues.get(student.courseId) ?? []), student]);
  }

  const assignments: Assignment[] = [];
  let remaining = students.length;

  for (const row of rows) {
    let leftCourse: string | null = null; // course of the student in the usable seat to the left

    for (const seat of row) {
      if (remaining === 0) break;

      // Pick a course other than the one to the left: the one with the most
      // front-row students left, then the one with the most students left.
      // Front-row students of one course can't sit side by side, so seating
      // the course with the most of them first fits the most into the front.
      // Ties are broken randomly so each generation looks different. Using up
      // the biggest course first keeps the plan as compact as possible.
      const frontRowLeft = (queue: StudentInput[]) => queue.filter((s) => s.frontRow).length;
      const candidates = shuffle([...queues.entries()], random)
        .filter(([courseId, queue]) => queue.length > 0 && courseId !== leftCourse)
        .sort(([, a], [, b]) => frontRowLeft(b) - frontRowLeft(a) || b.length - a.length);

      if (candidates.length === 0) {
        // Only the neighbour's course has students left: leave this seat empty.
        leftCourse = null;
        continue;
      }

      const [courseId, queue] = candidates[0];
      const student = queue.shift()!;
      assignments.push({ seatId: seat.id, studentId: student.id, courseId });
      leftCourse = courseId;
      remaining--;
    }
  }

  if (remaining > 0) {
    return {
      ok: false,
      error: `${students.length} students don't fit without same-course neighbours in this room with these rules. ${remaining} would be left without a seat.`,
    };
  }

  return { ok: true, assignments };
}

function zip(seats: SeatInput[], students: StudentInput[]): Assignment[] {
  return students.map((student, i) => ({
    seatId: seats[i].id,
    studentId: student.id,
    courseId: student.courseId,
  }));
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
