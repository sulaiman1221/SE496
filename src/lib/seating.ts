// Rule-based seating plan generator.
//
// The instructor picks exactly one rule per plan:
//   none      - students fill the room from the front in random order
//   spacing   - an empty seat between every two students in a row
//   alternate - no two students from the same course side by side; a student
//               from another course (or an empty seat) sits in between
//
// "Side by side" means consecutive seats in the same row, aisles included.
// Front/back doesn't count. Students always fill the room from the front;
// leftover seats at the back stay empty.

export type SeatingRule = "none" | "spacing" | "alternate";

export const SEATING_RULES: SeatingRule[] = ["none", "spacing", "alternate"];

export const RULE_LABELS: Record<SeatingRule, string> = {
  none: "No rule",
  spacing: "Empty seat between students",
  alternate: "Alternate courses",
};

export type SeatInput = { id: string; code: string; row: number; col: number };
export type StudentInput = { id: string; courseId: string };
export type Assignment = { seatId: string; studentId: string; courseId: string };

export type SeatingResult =
  | { ok: true; assignments: Assignment[] }
  | { ok: false; error: string };

export function isSeatingRule(value: unknown): value is SeatingRule {
  return typeof value === "string" && (SEATING_RULES as string[]).includes(value);
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

// How many students fit with an empty seat between each of them.
export function spacingCapacity(seats: SeatInput[]) {
  return seatRows(seats).reduce((sum, row) => sum + Math.ceil(row.length / 2), 0);
}

export function generateSeating(
  seats: SeatInput[],
  students: StudentInput[],
  rule: SeatingRule,
  random: () => number = Math.random,
): SeatingResult {
  if (students.length === 0) {
    return { ok: false, error: "There are no students to seat." };
  }

  const rows = seatRows(seats);

  if (rule === "none") {
    const frontFirst = rows.flat();
    if (students.length > frontFirst.length) {
      return {
        ok: false,
        error: `${students.length} students don't fit in a room with ${frontFirst.length} seats.`,
      };
    }
    return { ok: true, assignments: zip(frontFirst, shuffle(students, random)) };
  }

  if (rule === "spacing") {
    // Every other seat in each row, starting from the left.
    const usable = rows.flatMap((row) => row.filter((_, i) => i % 2 === 0));
    if (students.length > usable.length) {
      return {
        ok: false,
        error: `${students.length} students don't fit with an empty seat between them. This room fits ${usable.length} that way.`,
      };
    }
    return { ok: true, assignments: zip(usable, shuffle(students, random)) };
  }

  return alternate(rows, students, random);
}

function alternate(rows: SeatInput[][], students: StudentInput[], random: () => number): SeatingResult {
  // Shuffled queue of students per course.
  const queues = new Map<string, StudentInput[]>();
  for (const student of shuffle(students, random)) {
    queues.set(student.courseId, [...(queues.get(student.courseId) ?? []), student]);
  }
  if (queues.size < 2) {
    return { ok: false, error: "Alternating courses needs at least two courses in the exam." };
  }

  const assignments: Assignment[] = [];
  let remaining = students.length;

  for (const row of rows) {
    let leftCourse: string | null = null; // course of the student in the seat to the left

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
      error: `${students.length} students don't fit without same-course neighbours in this room. ${remaining} would be left without a seat.`,
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
