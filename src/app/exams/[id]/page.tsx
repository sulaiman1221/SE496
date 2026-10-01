import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import {
  formatExamDate,
  formatTimeRange,
  isUuid,
  roomLabel,
  statusColor,
  statusLabel,
} from "@/lib/exams";

async function getExam(id: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("exams")
    .select(
      `id, title, exam_date, start_time, end_time, status,
       rooms(name, seats(is_active)),
       exam_courses(courses(id, course_code, course_name, enrollments(student_id)))`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Could not load exam: ${error.message}`);
  return data;
}

export default async function ExamPage({ params }: PageProps<"/exams/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const exam = await getExam(id);
  if (!exam) notFound();

  const courses = exam.exam_courses
    .map((ec) => ec.courses)
    .sort((a, b) => a.course_code.localeCompare(b.course_code));
  const studentCount = new Set(
    courses.flatMap((c) => c.enrollments.map((e) => e.student_id)),
  ).size;
  const seatCount = exam.rooms.seats.filter((s) => s.is_active).length;
  const heading = exam.title ?? courses.map((c) => c.course_code).join(", ");
  const room = roomLabel(exam.rooms.name, seatCount);

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
          {courses.map((course) => (
            <li
              key={course.id}
              className="grid grid-cols-[4.5rem_1fr_auto] items-baseline gap-x-3 border-b border-line py-3"
            >
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
        <p className="mt-3 text-muted">Seating hasn&apos;t been generated for this exam yet.</p>
      </section>
    </>
  );
}
