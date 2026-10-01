import Link from "next/link";
import { connection } from "next/server";
import { todayISODate } from "@/lib/exams";
import { getCourseOptions, getRoomOptions } from "@/lib/queries";
import { NewExamForm } from "./new-exam-form";

export default async function NewExamPage() {
  await connection();
  const [courses, rooms] = await Promise.all([getCourseOptions(), getRoomOptions()]);

  return (
    <>
      <Link href="/exams" className="text-sm text-muted hover:text-ink">
        ← Exams
      </Link>
      <h1 className="mt-4 text-2xl font-medium tracking-tight">New exam</h1>
      <NewExamForm courses={courses} rooms={rooms} today={todayISODate()} />
    </>
  );
}
