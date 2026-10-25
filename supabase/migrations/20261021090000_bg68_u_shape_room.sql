
-- Row/column numbering (for the seating algorithm only; this room's
-- actual visual shape is drawn by u-shape-seat-map.tsx from the seat_code,
-- same approach as the auditorium): row_index groups seats into 10 "fill
-- ranks" from the seats nearest the open end of the room (rank 0) to the two
-- side tables (rank 9, filled last). column_index just needs to be unique
-- and ordered within a rank; where a rank combines two physically separate
-- groups (the two arm tables, the two side tables) they get a gap in
-- column_index so they're never treated as neighbours.
insert into public.rooms (name, layout_type, capacity) values
  ('BG-68', 'u_shape', 79)
on conflict (name) do nothing;

insert into public.seats (room_id, seat_code, row_index, column_index)
select r.id, v.seat_code, v.row_index, v.column_index
from public.rooms r
cross join (values
  -- rank 0-4: inner 3x5 block, nearest the opening first (row 0) back to
  -- furthest from it (row 4). Columns: left, centre, right.
  ('59', 0, 0), ('60', 0, 1), ('61', 0, 2),
  ('58', 1, 0), ('67', 1, 1), ('62', 1, 2),
  ('57', 2, 0), ('66', 2, 1), ('63', 2, 2),
  ('56', 3, 0), ('65', 3, 1), ('64', 3, 2),
  ('55', 4, 0), ('54', 4, 1), ('53', 4, 2),
  -- rank 5: head row, behind the block
  ('79', 5, 0), ('78', 5, 1), ('77', 5, 2), ('76', 5, 3),
  -- rank 6: top inner arc -- left to right by true position, not number
  ('46', 6, 0), ('45', 6, 1), ('44', 6, 2), ('43', 6, 3), ('42', 6, 4), ('41', 6, 5), ('40', 6, 6),
  -- rank 7: the two inner-ring arm tables (left then right, gap between)
  ('34', 7, 0), ('35', 7, 1), ('36', 7, 2), ('37', 7, 3), ('38', 7, 4), ('39', 7, 5),
  ('47', 7, 10), ('48', 7, 11), ('49', 7, 12), ('50', 7, 13), ('51', 7, 14), ('52', 7, 15),
  -- rank 8: outer ring, 33 seats, ordered left to right by true position
  -- (the curved arm's leftmost point isn't seat 1 -- see the note above)
  ('6', 8, 0), ('7', 8, 1), ('5', 8, 2), ('8', 8, 3), ('4', 8, 4), ('9', 8, 5), ('3', 8, 6),
  ('10', 8, 7), ('2', 8, 8), ('11', 8, 9), ('1', 8, 10), ('33', 8, 11), ('32', 8, 12),
  ('31', 8, 13), ('30', 8, 14), ('29', 8, 15), ('28', 8, 16), ('27', 8, 17), ('26', 8, 18),
  ('25', 8, 19), ('24', 8, 20), ('23', 8, 21), ('22', 8, 22), ('12', 8, 23), ('21', 8, 24),
  ('13', 8, 25), ('20', 8, 26), ('14', 8, 27), ('19', 8, 28), ('15', 8, 29), ('18', 8, 30),
  ('16', 8, 31), ('17', 8, 32),
  -- rank 9: the two small side tables, filled last (left then right)
  ('72', 9, 0), ('73', 9, 1), ('74', 9, 2), ('75', 9, 3),
  ('68', 9, 10), ('69', 9, 11), ('70', 9, 12), ('71', 9, 13)
) as v (seat_code, row_index, column_index)
where r.name = 'BG-68'
on conflict (room_id, seat_code) do nothing;
