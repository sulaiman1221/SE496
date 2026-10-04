"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { isUuid, todayISODate } from "@/lib/exams";
import { generateSeating, isSeatingRule, type StudentInput } from "@/lib/seating";

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

export type GenerateSeatingState = { error: string | null };

// A plan can only be (re)generated before it's approved.
const EDITABLE_STATUSES = ["draft", "generated"];

export async function generateSeatingPlan(
  examId: string,
  _prev: GenerateSeatingState,
  formData: FormData,
): Promise<GenerateSeatingState> {
  const rule = formData.get("rule");
  if (!isUuid(examId)) return { error: "Exam not found." };
  if (!isSeatingRule(rule)) return { error: "Choose a seating rule." };

  const supabase = createServerClient();

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id, status, room_id, exam_courses(course_id, courses(course_code))")
    .eq("id", examId)
    .maybeSingle();

  if (examError) return { error: "Couldn't load the exam. Try again." };
  if (!exam) return { error: "Exam not found." };
  if (!EDITABLE_STATUSES.includes(exam.status)) {
    return { error: "This seating plan has been approved and can't be regenerated." };
  }

  // Course order decides which course a student counts under if they're
  // enrolled in more than one of the exam's courses.
  const courseIds = exam.exam_courses
    .sort((a, b) => a.courses.course_code.localeCompare(b.courses.course_code))
    .map((ec) => ec.course_id);

  if (rule === "alternate" && courseIds.length < 2) {
    return { error: "Alternating courses needs at least two courses in the exam." };
  }

  const [enrollmentsRes, seatsRes] = await Promise.all([
    supabase.from("enrollments").select("student_id, course_id").in("course_id", courseIds),
    supabase
      .from("seats")
      .select("id, seat_code, row_index, column_index")
      .eq("room_id", exam.room_id)
      .eq("is_active", true),
  ]);

  if (enrollmentsRes.error || seatsRes.error) {
    return { error: "Couldn't load the students and seats. Try again." };
  }

  const students = new Map<string, StudentInput>();
  for (const courseId of courseIds) {
    for (const e of enrollmentsRes.data.filter((e) => e.course_id === courseId)) {
      if (!students.has(e.student_id)) {
        students.set(e.student_id, { id: e.student_id, courseId });
      }
    }
  }

  const seats = seatsRes.data.map((s) => ({
    id: s.id,
    code: s.seat_code,
    row: s.row_index,
    col: s.column_index,
  }));

  const result = generateSeating(seats, [...students.values()], rule);
  if (!result.ok) return { error: result.error };

  // Replace any previous plan for this exam.
  const { error: deleteError } = await supabase
    .from("seat_assignments")
    .delete()
    .eq("exam_id", exam.id);
  if (deleteError) return { error: "Couldn't save the seating plan. Try again." };

  const { error: insertError } = await supabase.from("seat_assignments").insert(
    result.assignments.map((a) => ({
      exam_id: exam.id,
      seat_id: a.seatId,
      student_id: a.studentId,
      course_id: a.courseId,
    })),
  );

  if (insertError) {
    await supabase.from("exams").update({ status: "draft" }).eq("id", exam.id);
    refresh();
    return { error: "Couldn't save the seating plan. Try again." };
  }

  const { error: updateError } = await supabase
    .from("exams")
    .update({ status: "generated", seating_constraints: { rule } })
    .eq("id", exam.id);
  if (updateError) return { error: "The plan was saved but the exam status didn't update. Try again." };

  refresh();
  return { error: null };
}

export type ApproveState = { error: string | null };

// Approving locks the plan: generateSeatingPlan refuses approved exams.
// Emailing students is a separate step.
export async function approveSeatingPlan(examId: string): Promise<ApproveState> {
  if (!isUuid(examId)) return { error: "Exam not found." };

  const supabase = createServerClient();

  const { count, error: countError } = await supabase
    .from("seat_assignments")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId);
  if (countError) return { error: "Couldn't approve the plan. Try again." };
  if (!count) return { error: "Generate a seating plan before approving it." };

  // Only a generated plan can be approved, which also stops double approval.
  const { data, error } = await supabase
    .from("exams")
    .update({ status: "approved" })
    .eq("id", examId)
    .eq("status", "generated")
    .select("id");
  if (error) return { error: "Couldn't approve the plan. Try again." };
  if (data.length === 0) return { error: "This plan can't be approved right now. Refresh the page." };

  refresh();
  return { error: null };
}
