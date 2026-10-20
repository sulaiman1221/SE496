-- Students the instructor has picked to sit in the front row of an exam, for
-- example because of a disability or an injury. Picked per exam, since the
-- reason is often temporary. The seating plan seats them first.

create table if not exists public.front_row_students (
  exam_id    uuid not null references public.exams (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (exam_id, student_id)
);

create index if not exists front_row_students_student_id_idx
  on public.front_row_students (student_id);

alter table public.front_row_students enable row level security;

drop policy if exists "Authenticated users can read front row students" on public.front_row_students;
create policy "Authenticated users can read front row students"
  on public.front_row_students for select to authenticated using (true);
