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

// Everything about one exam: room and seats, courses and their students (or,
// for a makeup exam, who sits it), the seating plan, front-row students,
// emails and check-ins. Used by the exam page, the PDF and the seat emails.
export async function getExamDetail(id: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("exams")
    .select(
      `id, title, exam_date, start_time, end_time, status, seating_constraints, makeup_of,
       exam_students(student_id),
       rooms(name, layout_type, seats(id, seat_code, row_index, column_index, is_active)),
       exam_courses(courses(id, course_code, course_name,
         enrollments(student_id, students(full_name, institution_student_id)))),
       front_row_students(student_id),
       seat_assignments(seat_id, student_id, course_id, students(full_name, institution_student_id, email, gender)),
       seat_emails(student_id, status, error),
       attendance(student_id, status, checked_in_at)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Could not load exam: ${error.message}`);
  return data;
}

export type ExamDetail = NonNullable<Awaited<ReturnType<typeof getExamDetail>>>;

// The makeup exams made for an exam, with who sits each one.
export async function getMakeupExams(examId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("exams")
    .select("id, exam_date, start_time, status, exam_students(student_id)")
    .eq("makeup_of", examId)
    .order("exam_date")
    .order("start_time");

  if (error) throw new Error(`Could not load makeup exams: ${error.message}`);
  return data;
}

// Just enough about an exam to link to it: for a makeup exam's "Makeup of".
export async function getExamSummary(examId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("exams")
    .select("id, title, exam_date, exam_courses(courses(course_code))")
    .eq("id", examId)
    .maybeSingle();

  if (error) throw new Error(`Could not load the exam: ${error.message}`);
  return data;
}

// The Outlook account seat emails are sent from, or null if none is connected.
// Leaves out the refresh token, which never needs to reach a page.
export async function getEmailSender() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("email_sender")
    .select("email")
    .maybeSingle();

  if (error) throw new Error(`Could not load the email account: ${error.message}`);
  return data;
}

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
