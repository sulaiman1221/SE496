-- Moving students during an exam, and a log of every card scan.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- Swap seats in place
--
-- A swap puts two students on each other's seats. Checked row by row, the
-- one-student-per-seat rule fails halfway through, so it's made deferrable:
-- move_student_seat checks it once, after both seats have changed. Nothing is
-- deleted, so attendance and email records linked to the seats stay intact.
-- ---------------------------------------------------------------------------

do $$
declare
  v_name       text;
  v_deferrable boolean;
begin
  select con.conname, con.condeferrable into v_name, v_deferrable
  from pg_constraint con
  where con.conrelid = 'public.seat_assignments'::regclass
    and con.contype = 'u'
    and (
      select array_agg(att.attname::text order by att.attname)
      from unnest(con.conkey) as k(attnum)
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum
    ) = array['exam_id', 'seat_id'];

  if v_name is not null and not v_deferrable then
    execute format('alter table public.seat_assignments drop constraint %I', v_name);
    v_name := null;
  end if;

  if v_name is null then
    alter table public.seat_assignments
      add constraint seat_assignments_exam_id_seat_id_key
      unique (exam_id, seat_id) deferrable initially immediate;
  end if;
end;
$$;

-- Moves a student to another seat; if it's taken, the two students swap.
-- Allowed from generating the plan until the exam is completed, including
-- during the exam: card readers check the seat plan at each scan, so they
-- accept students at their new seats straight away. Earlier check-ins are
-- kept as they were.
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
begin
  -- Lock the exam so two moves on the same plan can't interleave.
  perform 1 from public.exams
    where id = p_exam_id
      and status in ('generated', 'approved', 'notifications_sent', 'in_progress')
    for update;
  if not found then
    raise exception 'Seats can only be changed once a plan is generated and until the exam is completed.';
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

  select student_id into v_other_student
    from public.seat_assignments
    where exam_id = p_exam_id and seat_id = p_seat_id;

  -- Check one student per seat after both updates, not between them.
  set constraints public.seat_assignments_exam_id_seat_id_key deferred;

  -- The seat-in-room trigger rejects seats from another room.
  update public.seat_assignments
    set seat_id = p_seat_id
    where exam_id = p_exam_id and student_id = p_student_id;

  if v_other_student is not null then
    update public.seat_assignments
      set seat_id = v_from_seat
      where exam_id = p_exam_id and student_id = v_other_student;
  end if;
end;
$$;

-- Only the backend may call it.
revoke execute on function public.move_student_seat(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.move_student_seat(uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Card scans
--
-- Every scan a reader reports, accepted or not, so there's a full record of
-- who scanned where and when. attendance keeps one row per student with the
-- time they first checked in; this keeps everything else.
-- ---------------------------------------------------------------------------

create table if not exists public.attendance_scans (
  id          uuid primary key default gen_random_uuid(),
  -- Null when the reader sent an exam or reader that doesn't exist.
  exam_id     uuid references public.exams (id) on delete cascade,
  reader_id   uuid references public.readers (id) on delete set null,
  -- Exactly what the reader sent, even if it matched nothing.
  reader_code text not null,
  card_uid    text not null,
  student_id  uuid references public.students (id) on delete set null,
  -- The seat the reader is at.
  seat_id     uuid references public.seats (id) on delete set null,
  result      text not null check (result in ('accepted', 'rejected')),
  reason      text,
  scanned_at  timestamptz not null default now()
);

create index if not exists attendance_scans_exam_id_idx
  on public.attendance_scans (exam_id, scanned_at);
create index if not exists attendance_scans_student_id_idx
  on public.attendance_scans (student_id);

alter table public.attendance_scans enable row level security;

drop policy if exists "Authenticated users can read attendance scans" on public.attendance_scans;
create policy "Authenticated users can read attendance scans"
  on public.attendance_scans for select to authenticated using (true);

notify pgrst, 'reload schema';
