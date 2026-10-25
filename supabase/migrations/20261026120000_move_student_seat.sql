-- Moves a student to another seat in a generated (not yet approved) seating
-- plan. If the seat is taken, the two students swap. The instructor can move
-- anyone anywhere; the seating rules only apply when a plan is generated.
--
-- A swap briefly needs two students on one seat, which the one-student-per-
-- seat constraint doesn't allow, so the other student's row is taken out and
-- put back on the freed seat. Running it all in one function makes it one
-- transaction: either the whole move happens or nothing does.

create or replace function public.move_student_seat(
  p_exam_id    uuid,
  p_student_id uuid,
  p_seat_id    uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_from_seat     uuid;
  v_other_student uuid;
  v_other_course  uuid;
begin
  -- Lock the exam so two moves on the same plan can't interleave.
  perform 1 from public.exams
    where id = p_exam_id and status = 'generated'
    for update;
  if not found then
    raise exception 'This seating plan can''t be changed. Only a generated plan that isn''t approved yet can.';
  end if;

  select seat_id into v_from_seat
    from public.seat_assignments
    where exam_id = p_exam_id and student_id = p_student_id;
  if not found then
    raise exception 'This student doesn''t have a seat in this plan.';
  end if;

  if v_from_seat = p_seat_id then
    return;
  end if;

  select student_id, course_id into v_other_student, v_other_course
    from public.seat_assignments
    where exam_id = p_exam_id and seat_id = p_seat_id;

  if v_other_student is null then
    -- Empty seat: just move. The seat-in-room trigger rejects seats from
    -- another room.
    update public.seat_assignments
      set seat_id = p_seat_id
      where exam_id = p_exam_id and student_id = p_student_id;
  else
    -- Taken seat: swap. Before approval nobody has been emailed or checked in,
    -- so removing the other student's row for a moment loses nothing.
    delete from public.seat_assignments
      where exam_id = p_exam_id and student_id = v_other_student;
    update public.seat_assignments
      set seat_id = p_seat_id
      where exam_id = p_exam_id and student_id = p_student_id;
    insert into public.seat_assignments (exam_id, seat_id, student_id, course_id)
      values (p_exam_id, v_from_seat, v_other_student, v_other_course);
  end if;
end;
$$;

-- Only the backend may call it. Supabase lets the public API call functions
-- by default, which would let anyone with the publishable key move students.
revoke execute on function public.move_student_seat(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.move_student_seat(uuid, uuid, uuid) to service_role;
