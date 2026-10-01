import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import {
  courseColor,
  formatExamDate,
  formatTimeRange,
  isUuid,
  roomLabel,
  statusColor,
  statusLabel,
} from "@/lib/exams";
import { isSeatingRule, RULE_LABELS, spacingCapacity, type SeatingRule } from "@/lib/seating";
import { SeatMap, type SeatOccupant } from "./seat-map";
import { SeatingControls } from "./seating-controls";

async function getExam(id: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("exams")
    .select(
      `id, title, exam_date, start_time, end_time, status, seating_constraints,
       rooms(name, seats(id, seat_code, row_index, column_index, is_active)),
       exam_courses(courses(id, course_code, course_name, enrollments(student_id))),
       seat_assignments(seat_id, course_id, students(full_name, institution_student_id))`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Could not load exam: ${error.message}`);
  return data;
}

function savedRule(constraints: unknown): SeatingRule | null {
  if (constraints && typeof constraints === "object" && !Array.isArray(constraints)) {
    const rule = (constraints as Record<string, unknown>).rule;
    if (isSeatingRule(rule)) return rule;
  }
  return null;
}

export default async function ExamPage({ params }: PageProps<"/exams/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const exam = await getExam(id);
  if (!exam) notFound();

  const courses = exam.exam_courses
    .map((ec) => ec.courses)
    .sort((a, b) => a.course_code.localeCompare(b.course_code));
  const courseIndex = new Map(courses.map((c, i) => [c.id, i]));
  const courseCode = new Map(courses.map((c) => [c.id, c.course_code]));

  const studentCount = new Set(
    courses.flatMap((c) => c.enrollments.map((e) => e.student_id)),
  ).size;

  const seats = exam.rooms.seats
    .filter((s) => s.is_active)
    .map((s) => ({ id: s.id, code: s.seat_code, row: s.row_index, col: s.column_index }));
  const seatById = new Map(seats.map((s) => [s.id, s]));

  const occupants = new Map<string, SeatOccupant>(
    exam.seat_assignments.map((a) => [
      a.seat_id,
      {
        name: a.students.full_name,
        studentNumber: a.students.institution_student_id,
        courseCode: courseCode.get(a.course_id) ?? "",
        courseIndex: courseIndex.get(a.course_id) ?? 0,
      },
    ]),
  );

  // Seat-by-seat list, front row first.
  const assignmentRows = exam.seat_assignments
    .map((a) => ({ seat: seatById.get(a.seat_id), occupant: occupants.get(a.seat_id)! }))
    .filter((a) => a.seat)
    .sort((a, b) => a.seat!.row - b.seat!.row || a.seat!.col - b.seat!.col);

  const rule = savedRule(exam.seating_constraints);
  const hasPlan = exam.seat_assignments.length > 0;
  const editable = exam.status === "draft" || exam.status === "generated";
  const heading = exam.title ?? courses.map((c) => c.course_code).join(", ");
  const room = roomLabel(exam.rooms.name, seats.length);

  return (
    <>
      <Link href="/exams" className="text-sm text-muted hover:text-ink">
        ← Exams
      </Link>

      <h1 className="mt-4 text-2xl font-medium tracking-tight">{heading}</h1>
      <p className="mt-1 text-muted tabular-nums">
        {formatExamDate(exam.exam_date, { withYear: true })},{" "}
        {formatTimeRange(exam.start_time, exam.end_time)} · {room}
      </p>
      <p className="mt-3 flex items-center gap-2 text-sm">
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ backgroundColor: statusColor(exam.status) }}
        />
        {statusLabel(exam.status)}
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-medium">Courses</h2>
        <ul className="mt-3 border-t border-line">
          {courses.map((course, i) => (
            <li
              key={course.id}
              className="grid grid-cols-[auto_4.5rem_1fr_auto] items-center gap-x-3 border-b border-line py-3"
            >
              <span
                aria-hidden
                className="size-3 rounded-[3px] border"
                style={{ backgroundColor: courseColor(i).bg, borderColor: courseColor(i).border }}
              />
              <span className="font-mono text-[13px]">{course.course_code}</span>
              <span className="min-w-0 truncate">{course.course_name}</span>
              <span className="text-sm text-muted tabular-nums">
                {course.enrollments.length}{" "}
                {course.enrollments.length === 1 ? "student" : "students"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted tabular-nums">
          {studentCount} {studentCount === 1 ? "student" : "students"} in {room}
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium">Seating plan</h2>

        {editable && (
          <div className="mt-4">
            <SeatingControls
              examId={exam.id}
              currentRule={rule ?? "none"}
              hasPlan={hasPlan}
              courseCount={courses.length}
              spacingCapacity={spacingCapacity(seats)}
            />
          </div>
        )}

        {hasPlan ? (
          <>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm">
              <p className="text-muted tabular-nums">
                {rule ? `${RULE_LABELS[rule]}. ` : ""}
                {exam.seat_assignments.length} students seated,{" "}
                {seats.length - exam.seat_assignments.length} seats empty.
              </p>
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
                {courses.map((course, i) => (
                  <li key={course.id} className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-3 rounded-[3px] border"
                      style={{
                        backgroundColor: courseColor(i).bg,
                        borderColor: courseColor(i).border,
                      }}
                    />
                    <span className="font-mono text-[12px]">{course.course_code}</span>
                  </li>
                ))}
                <li className="flex items-center gap-1.5">
                  <span aria-hidden className="size-3 rounded-[3px] border border-dashed border-faint" />
                  Empty
                </li>
              </ul>
            </div>
            <div className="mt-4">
              <SeatMap seats={seats} occupants={occupants} />
            </div>

            <table className="mt-10 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2 pr-4 font-normal">Seat</th>
                  <th className="py-2 pr-4 font-normal">Student</th>
                  <th className="py-2 pr-4 font-normal">ID</th>
                  <th className="py-2 font-normal">Course</th>
                </tr>
              </thead>
              <tbody>
                {assignmentRows.map(({ seat, occupant }) => (
                  <tr key={seat!.id} className="border-b border-line">
                    <td className="py-2 pr-4 font-mono text-[13px]">{seat!.code}</td>
                    <td className="py-2 pr-4">{occupant.name}</td>
                    <td className="py-2 pr-4 tabular-nums text-muted">{occupant.studentNumber}</td>
                    <td className="py-2 font-mono text-[13px]">{occupant.courseCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          !editable && <p className="mt-3 text-muted">No seating plan.</p>
        )}
      </section>
    </>
  );
}
