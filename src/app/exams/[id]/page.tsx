import Link from "next/link";
import { notFound } from "next/navigation";
import {
  courseColor,
  formatExamDate,
  formatTimeRange,
  isUuid,
  MOVABLE_STATUSES,
  roomLabel,
  statusLabel,
} from "@/lib/exams";
import { getEmailSender, getExamDetail } from "@/lib/queries";
import {
  describeRules,
  frontRowChanged,
  isGender,
  ORDER_LABELS,
  savedOrder,
  savedRules,
  seatRows,
} from "@/lib/seating";
import { isTestAddress } from "@/lib/seat-email";
import { AuditoriumSeatMap } from "./auditorium-seat-map";
import { EmailControls } from "./email-controls";
import { SeatMap, type SeatOccupant } from "./seat-map";
import { SeatingControls } from "./seating-controls";
import { StudentTable, type StudentRow } from "./student-table";
import { UShapeSeatMap } from "./u-shape-seat-map";

export default async function ExamPage({ params, searchParams }: PageProps<"/exams/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  // Set by the Microsoft sign-in callback when connecting an account fails.
  const { emailError } = await searchParams;

  const [exam, sender] = await Promise.all([getExamDetail(id), getEmailSender()]);
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
        studentId: a.student_id,
        name: a.students.full_name,
        studentNumber: a.students.institution_student_id,
        gender: isGender(a.students.gender) ? a.students.gender : null,
        courseCode: courseCode.get(a.course_id) ?? "",
        courseIndex: courseIndex.get(a.course_id) ?? 0,
      },
    ]),
  );

  const seatEmails = new Map(exam.seat_emails.map((e) => [e.student_id, e]));
  const assignments = new Map(exam.seat_assignments.map((a) => [a.student_id, a]));
  const frontRowIds = exam.front_row_students.map((f) => f.student_id);
  const frontRow = new Set(frontRowIds);

  // Every student in the exam, under their first course (the same course the
  // seating plan counts them under) until they have a seat.
  const studentRows = new Map<string, StudentRow>();
  const seatOf = new Map<string, { row: number; col: number }>();
  for (const course of courses) {
    for (const e of course.enrollments) {
      if (studentRows.has(e.student_id)) continue;
      const assignment = assignments.get(e.student_id);
      const seat = assignment && seatById.get(assignment.seat_id);
      if (seat) seatOf.set(e.student_id, seat);
      studentRows.set(e.student_id, {
        studentId: e.student_id,
        name: e.students.full_name,
        studentNumber: e.students.institution_student_id,
        courseCode: courseCode.get(assignment?.course_id ?? course.id) ?? "",
        seatCode: seat?.code ?? null,
        frontRow: frontRow.has(e.student_id),
        email: seatEmails.get(e.student_id) ?? null,
      });
    }
  }
  // Seated students front row first, then anyone without a seat by name.
  const tableRows = [...studentRows.values()].sort((a, b) => {
    const [seatA, seatB] = [seatOf.get(a.studentId), seatOf.get(b.studentId)];
    if (seatA && seatB) return seatA.row - seatB.row || seatA.col - seatB.col;
    if (seatA || seatB) return seatA ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const rules = savedRules(exam.seating_constraints);
  const order = rules ? savedOrder(exam.seating_constraints) : null;
  const hasPlan = exam.seat_assignments.length > 0;
  const editable = exam.status === "draft" || exam.status === "generated";
  const frontRowNeedsRegenerate =
    hasPlan && editable && frontRowChanged(exam.seating_constraints, frontRowIds);
  const heading = exam.title ?? courses.map((c) => c.course_code).join(", ");
  const room = roomLabel(exam.rooms.name, seats.length);

  // Students who still need their seat email. Test addresses never get one,
  // so they're counted separately.
  const unsent = exam.seat_assignments.filter((a) => seatEmails.get(a.student_id)?.status !== "sent");
  const testAddressCount = unsent.filter((a) => isTestAddress(a.students.email)).length;
  const emailsRemaining = unsent.length - testAddressCount;

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
      <p className="mt-3 text-sm">{statusLabel(exam.status)}</p>

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

      {hasPlan && !editable && (
        <section className="mt-10">
          <h2 className="text-sm font-medium">Student emails</h2>
          <div className="mt-3">
            <EmailControls
              examId={exam.id}
              sender={sender?.email ?? null}
              remaining={emailsRemaining}
              testAddresses={testAddressCount}
              sentCount={exam.seat_assignments.length - unsent.length}
              started={exam.seat_emails.length > 0}
              connectError={typeof emailError === "string" ? emailError : null}
            />
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-medium">Seating plan</h2>

        {editable && (
          <div className="mt-4">
            <SeatingControls
              examId={exam.id}
              planRules={rules}
              planOrder={order}
              hasPlan={hasPlan}
              courseCount={courses.length}
              rowSizes={seatRows(seats).map((row) => row.length)}
              frontRowChanged={frontRowNeedsRegenerate}
            />
          </div>
        )}

        {hasPlan && !editable && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <p className="text-muted">
              {exam.status === "completed"
                ? "This exam is completed."
                : "This plan is approved. Students can still be moved by hand."}
            </p>
            <a
              href={`/exams/${exam.id}/pdf`}
              download
              className="rounded-[5px] border border-line bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-hover"
            >
              Download PDF
            </a>
          </div>
        )}

        {hasPlan ? (
          <>
            <div
              className={`${editable ? "mt-8" : "mt-6"} flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm`}
            >
              <p className="text-muted tabular-nums">
                {rules ? `${describeRules(rules)}. ` : ""}
                {order && order !== "random" ? `${ORDER_LABELS[order]}. ` : ""}
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
              <SeatMap
                examId={exam.id}
                layout={exam.rooms.layout_type}
                seats={seats}
                occupants={occupants}
                // Until the exam is completed; card readers follow moves straight away.
                movable={(MOVABLE_STATUSES as string[]).includes(exam.status)}
              />
            </div>
          </>
        ) : (
          !editable && <p className="mt-3 text-muted">No seating plan.</p>
        )}

        {/* Shown before generating too, so front-row students can be picked first. */}
        {(hasPlan || editable) && (
          <div className="mt-10">
            <StudentTable
              examId={exam.id}
              rows={tableRows}
              editable={editable}
              showEmail={hasPlan && !editable}
            />
          </div>
        )}
      </section>
    </>
  );
}
