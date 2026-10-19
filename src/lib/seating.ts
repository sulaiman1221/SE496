// Rule-based seating plan generator.
//
// The instructor can combine any of these rules in one plan (or pick none):
//   spacing   - an empty seat between every two students in a row
//   rows      - an empty row between every two rows of students
//   alternate - no two students from the same course next to each other in a
//               row; a student from another course (or an empty seat) sits in
//               between. With spacing on, the nearest student across the empty
//               seat is from a different course too.
//
// "Side by side" means consecutive seats in the same row, aisles included.
// Front/back only counts for the rows rule. Students always fill the room from
// the front; leftover seats at the back stay empty.
//
// Male and female students always sit apart: males on the left side of the
// room, females on the right (as the seat map shows it, front at the top).
// The two sides are split as close to the middle as both groups allow, at an
// aisle or with an empty column between them, and the rules apply within
// each side. An exam with only one gender uses the whole room.

export type SeatingRule = "spacing" | "rows" | "alternate";
export type Gender = "male" | "female";

// Also the order rules are listed and saved in.
export const SEATING_RULES: SeatingRule[] = ["spacing", "rows", "alternate"];

export const RULE_LABELS: Record<SeatingRule, string> = {
  spacing: "Empty seat between students",
  rows: "Empty row between students",
  alternate: "Alternate courses",
};

export type SeatInput = { id: string; code: string; row: number; col: number };
export type StudentInput = { id: string; courseId: string; gender: Gender };
export type Assignment = { seatId: string; studentId: string; courseId: string };

export type SeatingResult =
  | { ok: true; assignments: Assignment[] }
  | { ok: false; error: string };

export function isSeatingRule(value: unknown): value is SeatingRule {
  return typeof value === "string" && (SEATING_RULES as string[]).includes(value);
}

export function isGender(value: unknown): value is Gender {
  return value === "male" || value === "female";
}

// Known rules only, without duplicates, in SEATING_RULES order.
export function normalizeRules(values: unknown[]): SeatingRule[] {
  return SEATING_RULES.filter((rule) => values.includes(rule));
}

// The rules a plan was generated with, from exams.seating_constraints, or
// null if no plan has been generated yet.
export function savedRules(constraints: unknown): SeatingRule[] | null {
  if (!constraints || typeof constraints !== "object" || Array.isArray(constraints)) return null;
  const { rules, rule } = constraints as Record<string, unknown>;
  if (Array.isArray(rules)) return normalizeRules(rules);
  // Plans from before rules could be combined saved one rule, or "none".
  if (rule === "none") return [];
  if (isSeatingRule(rule)) return [rule];
  return null;
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
// empty, starting from the front and from the left.
function keepRow(index: number, rules: SeatingRule[]) {
  return !rules.includes("rows") || index % 2 === 0;
}

function keepSeat(index: number, rules: SeatingRule[]) {
  return !rules.includes("spacing") || index % 2 === 0;
}

function usableRows(rows: SeatInput[][], rules: SeatingRule[]) {
  return rows
    .filter((_, i) => keepRow(i, rules))
    .map((row) => row.filter((_, i) => keepSeat(i, rules)));
}

// How many students fit once the spacing rules leave their seats empty, given
// the number of seats in each row, front row first. Alternating courses can
// fit fewer, depending on how many students each course has.
export function roomCapacity(rowSizes: number[], rules: SeatingRule[]) {
  return rowSizes
    .filter((_, i) => keepRow(i, rules))
    .reduce((sum, size) => {
      const kept = Array.from({ length: size }, (_, i) => i).filter((i) => keepSeat(i, rules));
      return sum + kept.length;
    }, 0);
}

export function generateSeating(
  seats: SeatInput[],
  students: StudentInput[],
  rules: SeatingRule[],
  random: () => number = Math.random,
): SeatingResult {
  if (students.length === 0) {
    return { ok: false, error: "There are no students to seat." };
  }
  if (rules.includes("alternate") && new Set(students.map((s) => s.courseId)).size < 2) {
    return { ok: false, error: "Alternating courses needs at least two courses in the exam." };
  }

  const males = students.filter((s) => s.gender === "male");
  const females = students.filter((s) => s.gender === "female");
  if (males.length === 0 || females.length === 0) return seatGroup(seats, students, rules, random);

  for (const side of roomSplits(seats)) {
    const left = seatGroup(side.left, males, rules, random);
    if (!left.ok) continue;
    const right = seatGroup(side.right, females, rules, random);
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

// Seats one group of students in the given seats, following the rules.
function seatGroup(
  seats: SeatInput[],
  students: StudentInput[],
  rules: SeatingRule[],
  random: () => number,
): SeatingResult {
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

  if (rules.includes("alternate")) return alternate(rows, students, random);
  return { ok: true, assignments: zip(usable, shuffle(students, random)) };
}

// Fills the usable seats row by row so that consecutive usable seats in a row
// never hold the same course. If only one course is left (or a side of the
// room only has one), every other seat stays empty.
function alternate(rows: SeatInput[][], students: StudentInput[], random: () => number): SeatingResult {
  // Shuffled queue of students per course.
  const queues = new Map<string, StudentInput[]>();
  for (const student of shuffle(students, random)) {
    queues.set(student.courseId, [...(queues.get(student.courseId) ?? []), student]);
  }

  const assignments: Assignment[] = [];
  let remaining = students.length;

  for (const row of rows) {
    let leftCourse: string | null = null; // course of the student in the usable seat to the left

    for (const seat of row) {
      if (remaining === 0) break;

      // Pick the course with the most students left, other than the one to the
      // left. Ties are broken randomly so each generation looks different.
      // Using up the biggest course first keeps the plan as compact as possible.
      const candidates = shuffle([...queues.entries()], random)
        .filter(([courseId, queue]) => queue.length > 0 && courseId !== leftCourse)
        .sort(([, a], [, b]) => b.length - a.length);

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
