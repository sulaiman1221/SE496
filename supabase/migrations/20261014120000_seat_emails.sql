-- Emailing students their seats through Microsoft Graph.
--
-- Safe to run more than once, so it can be pasted into the SQL editor to try
-- the feature before this migration reaches main.

-- ---------------------------------------------------------------------------
-- Email sender
--
-- The Outlook account that seat emails are sent from. Someone signs in with
-- Microsoft once and the refresh token is kept here, so the app can send
-- later without signing in again. There is only ever one row.
-- ---------------------------------------------------------------------------

create table if not exists public.email_sender (
  id            boolean primary key default true check (id),
  email         text not null,
  display_name  text,
  refresh_token text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace trigger email_sender_set_updated_at
  before update on public.email_sender
  for each row execute function public.set_updated_at();

-- No policies: the refresh token can send mail as that account, so only the
-- backend (service role) can read it.
alter table public.email_sender enable row level security;

-- ---------------------------------------------------------------------------
-- Seat emails
--
-- One row per student per exam, recording whether their seat email went out.
-- Sent rows are never sent again, so a failed batch can be retried safely.
-- ---------------------------------------------------------------------------

create table if not exists public.seat_emails (
  id         uuid primary key default gen_random_uuid(),
  exam_id    uuid not null references public.exams (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete restrict,
  -- the address it was sent to, in case the student's email changes later
  email      text not null,
  status     text not null check (status in ('sent', 'failed', 'skipped')),
  error      text,
  sent_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, student_id),
  -- only students with a seat in this exam get an email
  foreign key (exam_id, student_id)
    references public.seat_assignments (exam_id, student_id) on delete cascade,
  check (status <> 'sent' or sent_at is not null)
);

create index if not exists seat_emails_student_id_idx on public.seat_emails (student_id);

create or replace trigger seat_emails_set_updated_at
  before update on public.seat_emails
  for each row execute function public.set_updated_at();

alter table public.seat_emails enable row level security;

drop policy if exists "Authenticated users can read seat emails" on public.seat_emails;
create policy "Authenticated users can read seat emails"
  on public.seat_emails for select to authenticated using (true);
