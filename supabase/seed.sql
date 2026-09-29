-- Demo data for the prototype: 5 students, 2 courses, one 5-seat room and
-- 5 readers (one per seat). Safe to run more than once.
--
-- RFID card UIDs are left empty here; they get filled in when the physical
-- cards are scanned and registered.

insert into public.courses (course_code, course_name) values
  ('SE100', 'Introduction to Software Engineering'),
  ('SE200', 'Software Design and Architecture')
on conflict (course_code) do nothing;

insert into public.students (institution_student_id, full_name, email) values
  ('1001', 'Sulaiman Alhammad',    'sulaiman.alhammad@example.com'),
  ('1002', 'Abdullah Bin Salamah', 'abdullah.binsalamah@example.com'),
  ('1003', 'Saleh Alkhattaf',      'saleh.alkhattaf@example.com'),
  ('1004', 'Naif Almubarak',       'naif.almubarak@example.com'),
  ('1005', 'Fayez Algosaibi',      'fayez.algosaibi@example.com')
on conflict (institution_student_id) do nothing;

-- SE100: 1001, 1003, 1005   SE200: 1002, 1004
insert into public.enrollments (student_id, course_id)
select s.id, c.id
from (values
  ('1001', 'SE100'),
  ('1002', 'SE200'),
  ('1003', 'SE100'),
  ('1004', 'SE200'),
  ('1005', 'SE100')
) as v (institution_student_id, course_code)
join public.students s on s.institution_student_id = v.institution_student_id
join public.courses  c on c.course_code = v.course_code
on conflict (student_id, course_id) do nothing;

insert into public.rooms (name, layout_type, capacity) values
  ('Demo Room', 'grid', 5)
on conflict (name) do nothing;

-- Layout:
--   row 0:  A1  A2  A3
--   row 1:  B1  B2
insert into public.seats (room_id, seat_code, row_index, column_index)
select r.id, v.seat_code, v.row_index, v.column_index
from (values
  ('A1', 0, 0),
  ('A2', 0, 1),
  ('A3', 0, 2),
  ('B1', 1, 0),
  ('B2', 1, 1)
) as v (seat_code, row_index, column_index)
join public.rooms r on r.name = 'Demo Room'
on conflict (room_id, seat_code) do nothing;

insert into public.readers (hardware_identifier, seat_id, label)
select v.hardware_identifier, s.id, v.label
from (values
  ('R01', 'A1', 'Reader at A1'),
  ('R02', 'A2', 'Reader at A2'),
  ('R03', 'A3', 'Reader at A3'),
  ('R04', 'B1', 'Reader at B1'),
  ('R05', 'B2', 'Reader at B2')
) as v (hardware_identifier, seat_code, label)
join public.rooms r on r.name = 'Demo Room'
join public.seats s on s.room_id = r.id and s.seat_code = v.seat_code
on conflict (hardware_identifier) do nothing;
