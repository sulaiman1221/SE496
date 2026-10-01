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
