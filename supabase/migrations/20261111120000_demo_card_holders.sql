-- The five physical RFID cards for the hardware demo, and a DEMO course that
-- holds just their owners, so an exam in the 5-seat Demo Room seats exactly
-- them. Safe to run more than once.
--
--   Card / reader 1  EA3CB883  Saleh Alkhattaf
--   Card / reader 2  BB6DCF55  Fayez Algosaibi
--   Card / reader 3  AB019955  Sulaiman Alhammad
--   Card / reader 4  3B07EE53  Abdullah Bin Salamah
--   Card / reader 5  7BE70854  Naif Almubarak

update public.students set rfid_uid = 'EA3CB883' where institution_student_id = '1003';
update public.students set rfid_uid = 'BB6DCF55' where institution_student_id = '1005';
update public.students set rfid_uid = 'AB019955' where institution_student_id = '1001';
update public.students set rfid_uid = '3B07EE53' where institution_student_id = '1002';
update public.students set rfid_uid = '7BE70854' where institution_student_id = '1004';

insert into public.courses (course_code, course_name) values
  ('DEMO', 'RFID Hardware Demo')
on conflict (course_code) do nothing;

insert into public.enrollments (student_id, course_id)
select s.id, c.id
from public.students s
join public.courses c on c.course_code = 'DEMO'
where s.institution_student_id in ('1001', '1002', '1003', '1004', '1005')
on conflict (student_id, course_id) do nothing;

notify pgrst, 'reload schema';
