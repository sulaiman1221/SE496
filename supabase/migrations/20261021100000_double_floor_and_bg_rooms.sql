-- BG-65 and BG-63 (70 seats each): identical simple layouts -- 5 rows of 14
-- desks with one centre aisle, same shape as Exam Hall but with the aisle.

insert into public.rooms (name, layout_type, capacity) values
  ('Double-Floor Room', 'grid', 65),
  ('BG-65', 'grid', 70),
  ('BG-63', 'grid', 70)
on conflict (name) do nothing;

-- Double-Floor Room
insert into public.seats (room_id, seat_code, row_index, column_index)
select r.id, v.seat_code, v.row_index, v.column_index
from public.rooms r
cross join (values
  -- upstairs: 5 rows of 7, numbered high-to-low left to right
  ('65', 0, 3), ('64', 0, 4), ('63', 0, 5), ('62', 0, 6), ('61', 0, 7), ('60', 0, 8), ('59', 0, 9),
  ('58', 1, 3), ('57', 1, 4), ('56', 1, 5), ('55', 1, 6), ('54', 1, 7), ('53', 1, 8), ('52', 1, 9),
  ('51', 2, 3), ('50', 2, 4), ('49', 2, 5), ('48', 2, 6), ('47', 2, 7), ('46', 2, 8), ('45', 2, 9),
  ('44', 3, 3), ('43', 3, 4), ('42', 3, 5), ('41', 3, 6), ('40', 3, 7), ('39', 3, 8), ('38', 3, 9),
  ('37', 4, 3), ('36', 4, 4), ('35', 4, 5), ('34', 4, 6), ('33', 4, 7), ('32', 4, 8), ('31', 4, 9),
  -- downstairs: two clusters of desks, the back row of each only 3 wide
  ('30', 5, 0), ('29', 5, 1), ('28', 5, 2), ('27', 5, 10), ('26', 5, 11), ('25', 5, 12),
  ('24', 6, 0), ('23', 6, 1), ('22', 6, 2), ('21', 6, 3), ('20', 6, 10), ('19', 6, 11), ('18', 6, 12), ('17', 6, 13),
  ('16', 7, 0), ('15', 7, 1), ('14', 7, 2), ('13', 7, 3), ('12', 7, 10), ('11', 7, 11), ('10', 7, 12), ('9', 7, 13),
  ('8', 8, 0), ('7', 8, 1), ('6', 8, 2), ('5', 8, 3), ('4', 8, 10), ('3', 8, 11), ('2', 8, 12), ('1', 8, 13)
) as v (seat_code, row_index, column_index)
where r.name = 'Double-Floor Room'
on conflict (room_id, seat_code) do nothing;

-- BG-65 and BG-63: 5 rows of 14 desks, aisle after the 7th seat in each row.
insert into public.seats (room_id, seat_code, row_index, column_index)
select r.id, (row_i * 14 + col_i + 1)::text, row_i, (case when col_i < 7 then col_i else col_i + 1 end)
from public.rooms r
cross join generate_series(0, 4) as row_i
cross join generate_series(0, 13) as col_i
where r.name in ('BG-65', 'BG-63')
on conflict (room_id, seat_code) do nothing;
