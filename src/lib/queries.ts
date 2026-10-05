import "server-only";
import { createServerClient } from "@/lib/supabase/server";

export type CourseOption = {
  id: string;
  code: string;
  name: string;
  studentIds: string[];
};

export type RoomOption = {
  id: string;
  name: string;
  seatCount: number;
};

export async function getCourseOptions(): Promise<CourseOption[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, course_code, course_name, enrollments(student_id)")
    .order("course_code");

  if (error) throw new Error(`Could not load courses: ${error.message}`);

  return data.map((c) => ({
    id: c.id,
    code: c.course_code,
    name: c.course_name,
    studentIds: c.enrollments.map((e) => e.student_id),
  }));
}

// Everything about one exam: room and seats, courses, and the seating plan.
// Used by the exam page and the seating plan PDF.
export async function getExamDetail(id: string) {
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

export type ExamDetail = NonNullable<Awaited<ReturnType<typeof getExamDetail>>>;

// Seat count is the number of active seats, which is what the seating plan
// can actually use.
export async function getRoomOptions(): Promise<RoomOption[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("rooms")
    .select("id, name, seats(is_active)")
    .order("name");

  if (error) throw new Error(`Could not load rooms: ${error.message}`);

  return data.map((r) => ({
    id: r.id,
    name: r.name,
    seatCount: r.seats.filter((s) => s.is_active).length,
  }));
}
