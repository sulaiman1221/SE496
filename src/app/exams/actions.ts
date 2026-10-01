"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { isUuid, todayISODate } from "@/lib/exams";

export type CreateExamState = { error: string | null };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export async function createExam(
  _prev: CreateExamState,
  formData: FormData,
): Promise<CreateExamState> {
  const courseIds = [...new Set(formData.getAll("courseId").map(String))];
  const roomId = String(formData.get("roomId") ?? "");
  const examDate = String(formData.get("examDate") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const title = String(formData.get("title") ?? "").trim();

  if (courseIds.length === 0 || !courseIds.every(isUuid)) {
    return { error: "Select at least one course." };
  }
  if (!isUuid(roomId)) {
    return { error: "Select a room." };
  }
  if (!DATE_RE.test(examDate)) {
    return { error: "Enter the exam date." };
  }
  if (examDate < todayISODate()) {
    return { error: "The exam date can't be in the past." };
  }
  if (!TIME_RE.test(startTime)) {
    return { error: "Enter a start time." };
  }
  if (endTime && (!TIME_RE.test(endTime) || endTime <= startTime)) {
    return { error: "The end time must be after the start time." };
  }

  const supabase = createServerClient();

  const [coursesRes, enrollmentsRes, seatsRes] = await Promise.all([
    supabase.from("courses").select("id").in("id", courseIds),
    supabase.from("enrollments").select("student_id").in("course_id", courseIds),
    supabase.from("seats").select("id").eq("room_id", roomId).eq("is_active", true),
  ]);

  if (coursesRes.error || enrollmentsRes.error || seatsRes.error) {
    return { error: "Something went wrong loading the courses and room. Try again." };
  }
  if (coursesRes.data.length !== courseIds.length) {
    return { error: "One of the selected courses no longer exists." };
  }

  const studentCount = new Set(enrollmentsRes.data.map((e) => e.student_id)).size;
  const seatCount = seatsRes.data.length;

  if (studentCount === 0) {
    return { error: "The selected courses have no enrolled students." };
  }
  if (studentCount > seatCount) {
    return {
      error: `${studentCount} students won't fit in a room with ${seatCount} seats.`,
    };
  }

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .insert({
      room_id: roomId,
      exam_date: examDate,
      start_time: startTime,
      end_time: endTime || null,
      title: title || null,
    })
    .select("id")
    .single();

  if (examError) {
    return { error: "Couldn't save the exam. Try again." };
  }

  const { error: linkError } = await supabase
    .from("exam_courses")
    .insert(courseIds.map((courseId) => ({ exam_id: exam.id, course_id: courseId })));

  if (linkError) {
    // Don't leave an exam with no courses behind.
    await supabase.from("exams").delete().eq("id", exam.id);
    return { error: "Couldn't save the exam. Try again." };
  }

  redirect(`/exams/${exam.id}`);
}
