-- Initial schema: students, courses, rooms/seats, exams, seating plans,
-- RFID readers and attendance.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Students and courses
-- ---------------------------------------------------------------------------

create table public.students (
  id                     uuid primary key default gen_random_uuid(),
  institution_student_id text not null unique,
  full_name              text not null,
  email                  text not null unique,
  rfid_uid               text unique,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger students_set_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  course_code text not null unique,
  course_name text not null,
  created_at  timestamptz not null default now()
);

create table public.enrollments (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  course_id  uuid not null references public.courses (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, course_id)
);

create index enrollments_course_id_idx on public.enrollments (course_id);

-- ---------------------------------------------------------------------------
-- Rooms and seats
-- ---------------------------------------------------------------------------

create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  layout_type text not null default 'grid',
  capacity    integer not null check (capacity > 0),
  created_at  timestamptz not null default now()
);

create table public.seats (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms (id) on delete cascade,
  seat_code    text not null,
  row_index    integer not null check (row_index >= 0),
  column_index integer not null check (column_index >= 0),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (room_id, seat_code),
  unique (room_id, row_index, column_index)
);

-- ---------------------------------------------------------------------------
-- Exams
-- ---------------------------------------------------------------------------

create table public.exams (
  id                  uuid primary key default gen_random_uuid(),
  title               text,
  room_id             uuid not null references public.rooms (id) on delete restrict,
  exam_date           date not null,
  start_time          time not null,
  end_time            time,
  status              text not null default 'draft'
                      check (status in (
                        'draft',
                        'generated',
                        'approved',
                        'notifications_sent',
                        'in_progress',
                        'completed'
                      )),
  -- constraints the instructor picked, e.g. {"alternate_courses": true, "empty_seat_between": false}
  seating_constraints jsonb not null default '{}'::jsonb,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (end_time is null or end_time > start_time)
);

create index exams_room_id_idx on public.exams (room_id);

create trigger exams_set_updated_at
  before update on public.exams
  for each row execute function public.set_updated_at();

-- An exam session can cover several courses sharing one room.
create table public.exam_courses (
  id        uuid primary key default gen_random_uuid(),
  exam_id   uuid not null references public.exams (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete restrict,
  unique (exam_id, course_id)
);

create index exam_courses_course_id_idx on public.exam_courses (course_id);

-- ---------------------------------------------------------------------------
-- Seating plan
-- ---------------------------------------------------------------------------

create table public.seat_assignments (
  id         uuid primary key default gen_random_uuid(),
  exam_id    uuid not null references public.exams (id) on delete cascade,
  seat_id    uuid not null references public.seats (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  course_id  uuid not null references public.courses (id) on delete restrict,
  created_at timestamptz not null default now(),
  -- one student per seat, one seat per student
  unique (exam_id, seat_id),
  unique (exam_id, student_id),
  -- the course must be part of this exam
  foreign key (exam_id, course_id)
    references public.exam_courses (exam_id, course_id) on delete cascade,
  -- the student must be enrolled in that course
  foreign key (student_id, course_id)
    references public.enrollments (student_id, course_id)
);

create index seat_assignments_seat_id_idx on public.seat_assignments (seat_id);
create index seat_assignments_student_course_idx on public.seat_assignments (student_id, course_id);

-- The seat must be an active seat in the exam's room.
create or replace function public.check_seat_in_exam_room()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.seats s
    join public.exams e on e.room_id = s.room_id
    where s.id = new.seat_id
      and e.id = new.exam_id
      and s.is_active
  ) then
    raise exception 'Seat % is not an active seat in the room for exam %',
      new.seat_id, new.exam_id;
  end if;
  return new;
end;
$$;

create trigger seat_assignments_check_room
  before insert or update of seat_id, exam_id on public.seat_assignments
  for each row execute function public.check_seat_in_exam_room();

-- ---------------------------------------------------------------------------
-- RFID readers
-- ---------------------------------------------------------------------------

-- Each physical reader sits at one seat. A reader can be registered before
-- it is mounted, so seat_id is nullable.
create table public.readers (
  id                  uuid primary key default gen_random_uuid(),
  hardware_identifier text not null unique,
  seat_id             uuid unique references public.seats (id) on delete set null,
  label               text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------------

create table public.attendance (
  id            uuid primary key default gen_random_uuid(),
  exam_id       uuid not null references public.exams (id) on delete cascade,
  student_id    uuid not null references public.students (id) on delete restrict,
  status        text not null default 'absent'
                check (status in ('absent', 'present')),
  checked_in_at timestamptz,
  seat_id       uuid references public.seats (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- one attendance row per student per exam (scans are idempotent)
  unique (exam_id, student_id),
  -- only students with a seat in this exam can have attendance
  foreign key (exam_id, student_id)
    references public.seat_assignments (exam_id, student_id) on delete cascade,
  check (status <> 'present' or checked_in_at is not null)
);

create index attendance_student_id_idx on public.attendance (student_id);

create trigger attendance_set_updated_at
  before update on public.attendance
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
--
-- All writes go through the backend using the service role, which bypasses
-- RLS. Signed-in instructors can read everything; anonymous clients get
-- nothing.
-- ---------------------------------------------------------------------------

alter table public.students         enable row level security;
alter table public.courses          enable row level security;
alter table public.enrollments      enable row level security;
alter table public.rooms            enable row level security;
alter table public.seats            enable row level security;
alter table public.exams            enable row level security;
alter table public.exam_courses     enable row level security;
alter table public.seat_assignments enable row level security;
alter table public.readers          enable row level security;
alter table public.attendance       enable row level security;

create policy "Authenticated users can read students"
  on public.students for select to authenticated using (true);
create policy "Authenticated users can read courses"
  on public.courses for select to authenticated using (true);
create policy "Authenticated users can read enrollments"
  on public.enrollments for select to authenticated using (true);
create policy "Authenticated users can read rooms"
  on public.rooms for select to authenticated using (true);
create policy "Authenticated users can read seats"
  on public.seats for select to authenticated using (true);
create policy "Authenticated users can read exams"
  on public.exams for select to authenticated using (true);
create policy "Authenticated users can read exam courses"
  on public.exam_courses for select to authenticated using (true);
create policy "Authenticated users can read seat assignments"
  on public.seat_assignments for select to authenticated using (true);
create policy "Authenticated users can read readers"
  on public.readers for select to authenticated using (true);
create policy "Authenticated users can read attendance"
  on public.attendance for select to authenticated using (true);
