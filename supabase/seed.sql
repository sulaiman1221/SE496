-- Demo data for the prototype: 30 students, 2 courses, three rooms (a 5-seat
-- demo room with one RFID reader per seat, a 20-seat classroom and a 56-seat
-- exam hall). Safe to run more than once.
--
-- Students 1001-1005 are the ones with physical RFID cards for the hardware
-- demo. 1006-1030 fill out the courses so seating plans have realistic sizes.
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
  ('1005', 'Fayez Algosaibi',      'fayez.algosaibi@example.com'),
  ('1006', 'Mohammed Alqahtani',   'mohammed.alqahtani@example.com'),
  ('1007', 'Abdulrahman Alotaibi', 'abdulrahman.alotaibi@example.com'),
  ('1008', 'Khalid Alshehri',      'khalid.alshehri@example.com'),
  ('1009', 'Faisal Aldosari',      'faisal.aldosari@example.com'),
  ('1010', 'Omar Alzahrani',       'omar.alzahrani@example.com'),
  ('1011', 'Yousef Alharbi',       'yousef.alharbi@example.com'),
  ('1012', 'Turki Almutairi',      'turki.almutairi@example.com'),
  ('1013', 'Majed Alghamdi',       'majed.alghamdi@example.com'),
  ('1014', 'Nasser Alshammari',    'nasser.alshammari@example.com'),
  ('1015', 'Hamad Alanazi',        'hamad.alanazi@example.com'),
  ('1016', 'Rayan Alsubaie',       'rayan.alsubaie@example.com'),
  ('1017', 'Bader Alrashidi',      'bader.alrashidi@example.com'),
  ('1018', 'Ziyad Alamri',         'ziyad.alamri@example.com'),
  ('1019', 'Meshal Albalawi',      'meshal.albalawi@example.com'),
  ('1020', 'Hassan Alyami',        'hassan.alyami@example.com'),
  ('1021', 'Ibrahim Alkhaldi',     'ibrahim.alkhaldi@example.com'),
  ('1022', 'Nawaf Aljohani',       'nawaf.aljohani@example.com'),
  ('1023', 'Sultan Alenezi',       'sultan.alenezi@example.com'),
  ('1024', 'Waleed Alhamdan',      'waleed.alhamdan@example.com'),
  ('1025', 'Abdulaziz Alsuwailem', 'abdulaziz.alsuwailem@example.com'),
  ('1026', 'Talal Almalki',        'talal.almalki@example.com'),
  ('1027', 'Saud Alruwaili',       'saud.alruwaili@example.com'),
  ('1028', 'Mansour Alkathiri',    'mansour.alkathiri@example.com'),
  ('1029', 'Ahmed Alfaraj',        'ahmed.alfaraj@example.com'),
  ('1030', 'Ali Alhajri',          'ali.alhajri@example.com')
on conflict (institution_student_id) do nothing;

-- SE100: 20 students   SE200: 10 students
insert into public.enrollments (student_id, course_id)
select s.id, c.id
from (
  select unnest(array[
    '1001', '1003', '1005', '1006', '1007', '1008', '1009', '1010', '1011', '1012',
    '1013', '1014', '1015', '1016', '1017', '1018', '1019', '1020', '1021', '1022'
  ]) as institution_student_id, 'SE100' as course_code
  union all
  select unnest(array[
    '1002', '1004', '1023', '1024', '1025', '1026', '1027', '1028', '1029', '1030'
  ]), 'SE200'
) as v
join public.students s on s.institution_student_id = v.institution_student_id
join public.courses  c on c.course_code = v.course_code
on conflict (student_id, course_id) do nothing;

insert into public.rooms (name, layout_type, capacity) values
  ('Demo Room', 'grid', 5),
  ('Classroom', 'grid', 20),
  ('Exam Hall', 'grid', 56)
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

-- Classroom: 5 rows of 4 desks, in pairs either side of a centre aisle.
-- Row A is at the front (whiteboard). Column 2 is the aisle and has no
-- seats, so A2 and A3 are not neighbours.
--   A1 A2 | A3 A4
--   ...
--   E1 E2 | E3 E4
insert into public.seats (room_id, seat_code, row_index, column_index)
select r.id, chr(65 + row_i) || (desk_i + 1), row_i, (array[0, 1, 3, 4])[desk_i + 1]
from public.rooms r
cross join generate_series(0, 4) as row_i
cross join generate_series(0, 3) as desk_i
where r.name = 'Classroom'
on conflict (room_id, seat_code) do nothing;

-- Exam Hall: 8 rows of 7 evenly spaced desks, no aisles. Row A is at the front.
--   A1 A2 A3 A4 A5 A6 A7
--   ...
--   H1 H2 H3 H4 H5 H6 H7
insert into public.seats (room_id, seat_code, row_index, column_index)
select r.id, chr(65 + row_i) || (col_i + 1), row_i, col_i
from public.rooms r
cross join generate_series(0, 7) as row_i
cross join generate_series(0, 6) as col_i
where r.name = 'Exam Hall'
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
