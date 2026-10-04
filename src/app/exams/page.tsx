import Link from "next/link";
import { connection } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { formatExamDate, formatTime, roomLabel, statusLabel, todayISODate } from "@/lib/exams";

async function getExams() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("exams")
    .select(
      "id, title, exam_date, start_time, status, rooms(name, seats(is_active)), exam_courses(courses(course_code))",
    )
    .order("exam_date")
    .order("start_time");

  if (error) throw new Error(`Could not load exams: ${error.message}`);
  return data;
}

type Exam = Awaited<ReturnType<typeof getExams>>[number];

export default async function ExamsPage() {
  await connection();
  const exams = await getExams();

  // Upcoming exams first (soonest at the top), then past exams (most recent first).
  const today = todayISODate();
  const upcoming = exams.filter((e) => e.exam_date >= today);
  const past = exams.filter((e) => e.exam_date < today).reverse();

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-tight">Exams</h1>
        {exams.length > 0 && <NewExamButton />}
      </div>

      {exams.length === 0 ? (
        <div className="mt-10">
          <p className="text-muted">No exams yet.</p>
          <div className="mt-4">
            <NewExamButton />
          </div>
        </div>
      ) : (
        <ul className="mt-8 border-t border-line">
          {upcoming.map((exam) => (
            <ExamRow key={exam.id} exam={exam} />
          ))}
          {past.map((exam) => (
            <ExamRow key={exam.id} exam={exam} isPast />
          ))}
        </ul>
      )}
    </>
  );
}

function NewExamButton() {
  return (
    <Link
      href="/exams/new"
      className="inline-block rounded-[5px] bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
    >
      New exam
    </Link>
  );
}

function ExamRow({ exam, isPast = false }: { exam: Exam; isPast?: boolean }) {
  const courseCodes = exam.exam_courses
    .map((ec) => ec.courses.course_code)
    .sort()
    .join(", ");

  return (
    <li className="border-b border-line">
      <Link
        href={`/exams/${exam.id}`}
        className={`-mx-3 grid grid-cols-1 gap-x-6 gap-y-1 px-3 py-4 transition-colors hover:bg-hover sm:grid-cols-[9rem_1fr_11rem_12rem] sm:items-baseline ${
          isPast ? "text-faint" : ""
        }`}
      >
        <span className="tabular-nums">
          {formatExamDate(exam.exam_date)}, {formatTime(exam.start_time)}
        </span>
        <span className="min-w-0 truncate">
          {exam.title ? (
            <>
              {exam.title}{" "}
              <span className={`font-mono text-[13px] ${isPast ? "" : "text-muted"}`}>
                {courseCodes}
              </span>
            </>
          ) : (
            <span className="font-mono text-[13px]">{courseCodes}</span>
          )}
        </span>
        <span className={isPast ? "" : "text-muted"}>
          {roomLabel(exam.rooms.name, exam.rooms.seats.filter((s) => s.is_active).length)}
        </span>
        <span className="text-sm">{statusLabel(exam.status)}</span>
      </Link>
    </li>
  );
}
