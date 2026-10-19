import Link from "next/link";
import { notFound } from "next/navigation";
import {
  courseColor,
  formatExamDate,
  formatTimeRange,
  isUuid,
  roomLabel,
  statusLabel,
} from "@/lib/exams";
import { getEmailSender, getExamDetail } from "@/lib/queries";
import { describeRules, isGender, savedRules, seatRows } from "@/lib/seating";
import { isTestAddress } from "@/lib/seat-email";
import { EmailControls } from "./email-controls";
import { SeatMap, type SeatOccupant } from "./seat-map";
import { SeatingControls } from "./seating-controls";

const EMAIL_STATUS_LABELS: Record<string, string> = {
  sent: "Sent",
  failed: "Failed",
  skipped: "Skipped",
};

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
        name: a.students.full_name,
        studentNumber: a.students.institution_student_id,
        gender: isGender(a.students.gender) ? a.students.gender : null,
        courseCode: courseCode.get(a.course_id) ?? "",
        courseIndex: courseIndex.get(a.course_id) ?? 0,
      },
    ]),
  );

  const seatEmails = new Map(exam.seat_emails.map((e) => [e.student_id, e]));

  // Seat-by-seat list, front row first.
  const assignmentRows = exam.seat_assignments
    .map((a) => ({
      seat: seatById.get(a.seat_id),
      occupant: occupants.get(a.seat_id)!,
      email: seatEmails.get(a.student_id),
    }))
    .filter((a) => a.seat)
    .sort((a, b) => a.seat!.row - b.seat!.row || a.seat!.col - b.seat!.col);

  const rules = savedRules(exam.seating_constraints);
  const hasPlan = exam.seat_assignments.length > 0;
  const editable = exam.status === "draft" || exam.status === "generated";
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
              hasPlan={hasPlan}
              courseCount={courses.length}
              rowSizes={seatRows(seats).map((row) => row.length)}
            />
          </div>
        )}

        {hasPlan && !editable && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <p className="text-muted">This plan is approved and locked.</p>
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
                  <th className="py-2 pr-4 font-normal">Course</th>
                  {!editable && <th className="py-2 font-normal">Email</th>}
                </tr>
              </thead>
              <tbody>
                {assignmentRows.map(({ seat, occupant, email }) => (
                  <tr key={seat!.id} className="border-b border-line">
                    <td className="py-2 pr-4 font-mono text-[13px]">{seat!.code}</td>
                    <td className="py-2 pr-4">{occupant.name}</td>
                    <td className="py-2 pr-4 tabular-nums text-muted">{occupant.studentNumber}</td>
                    <td className="py-2 pr-4 font-mono text-[13px]">{occupant.courseCode}</td>
                    {!editable && (
                      <td
                        title={email?.error ?? undefined}
                        className={
                          email?.status === "failed"
                            ? "py-2 text-danger"
                            : email?.status === "sent"
                              ? "py-2"
                              : "py-2 text-muted"
                        }
                      >
                        {email ? (EMAIL_STATUS_LABELS[email.status] ?? email.status) : "Not sent"}
                      </td>
                    )}
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
