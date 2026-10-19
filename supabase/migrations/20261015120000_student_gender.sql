-- Exams seat male and female students on separate sides of the room, so the
-- seating plan needs each student's gender. Left empty for existing students;
-- a plan can't be generated until everyone in the exam has one.

alter table public.students
  add column if not exists gender text check (gender in ('male', 'female'));
