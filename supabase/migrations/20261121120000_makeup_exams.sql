-- Makeup exams: a new exam for students who missed one.
--
-- A normal exam seats every student enrolled in its courses. A makeup exam
-- seats only the students listed for it in exam_students, and points back to
-- the exam they missed through makeup_of.
--
-- Safe to run more than once.

alter table public.exams
  add column if not exists makeup_of uuid references public.exams (id) on delete set null;

create index if not exists exams_makeup_of_idx on public.exams (makeup_of);

-- The students who sit an exam, when it isn't everyone in its courses. An
-- exam with rows here seats only these students.
create table if not exists public.exam_students (
  exam_id    uuid not null references public.exams (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (exam_id, student_id)
);

create index if not exists exam_students_student_id_idx on public.exam_students (student_id);

alter table public.exam_students enable row level security;

drop policy if exists "Authenticated users can read exam students" on public.exam_students;
create policy "Authenticated users can read exam students"
  on public.exam_students for select to authenticated using (true);

notify pgrst, 'reload schema';
