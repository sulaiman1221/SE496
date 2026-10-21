-- row_index is shared by every section within a tier, so the "fill from the
-- front" rule fills across the whole front tier before moving to the back
-- tier; column_index has a gap between every section for the aisles. Seat
-- codes are "<section>-<row>-<seat>" (e.g. "7-3-5"), which is what the
-- auditorium seat map reads to draw the room's actual wedge layout --
-- row_index/column_index here are only for the seating algorithm.
insert into public.rooms (name, layout_type, capacity) values
  ('Princess Haya Auditorium', 'fan_auditorium', 972)
on conflict (name) do nothing;

insert into public.seats (room_id, seat_code, row_index, column_index)
select
  r.id,
  sec.section || '-' || (row_i + 1) || '-' || (seat_i + 1),
  sec.tier * 9 + row_i,
  sec.order_in_tier * 10 + (case when sec.order_in_tier >= 3 then 1 else 0 end) + seat_i
from public.rooms r
cross join (
  values
    ('1',  0, 0), ('2',  0, 1), ('3',  0, 2),
    ('7',  0, 3), ('8',  0, 4), ('9',  0, 5),
    ('4',  1, 0), ('5',  1, 1), ('6',  1, 2),
    ('10', 1, 3), ('11', 1, 4), ('12', 1, 5)
) as sec(section, tier, order_in_tier)
cross join generate_series(0, 8) as row_i
cross join generate_series(0, 8) as seat_i
where r.name = 'Princess Haya Auditorium'
on conflict (room_id, seat_code) do nothing;
