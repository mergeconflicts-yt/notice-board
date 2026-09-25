-- Manual note positions: any member may move a note; the spot persists.
begin;
select plan(12);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-000000000081', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000082', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000083', 'authenticated', 'authenticated');
insert into public.boards (id, name, created_by)
values ('b0000000-0000-0000-0000-000000000081', 'Board', 'a0000000-0000-0000-0000-000000000081');
insert into public.board_members (board_id, user_id, role) values
  ('b0000000-0000-0000-0000-000000000081', 'a0000000-0000-0000-0000-000000000081', 'owner'),
  ('b0000000-0000-0000-0000-000000000081', 'a0000000-0000-0000-0000-000000000082', 'member');
insert into public.items (id, board_id, type, body, created_by)
values ('c0000000-0000-0000-0000-000000000081', 'b0000000-0000-0000-0000-000000000081',
        'note', 'draggable', 'a0000000-0000-0000-0000-000000000081');

select is(
  (select layout from public.items where id = 'c0000000-0000-0000-0000-000000000081'),
  null, 'starts auto-placed');

-- Member moves it.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000082', true);
set role authenticated;
select lives_ok(
  $$select public.set_item_position('c0000000-0000-0000-0000-000000000081', 0.7, 320)$$,
  'member moves a note');
reset role;
select is(
  (select layout ->> 'x' from public.items
   where id = 'c0000000-0000-0000-0000-000000000081'),
  '0.7', 'x stored');
select is(
  (select layout ->> 'y' from public.items
   where id = 'c0000000-0000-0000-0000-000000000081'),
  '320', 'y stored');
-- Moving a note must not bump the version: doing so would cancel an author's
-- in-flight text edit on another device.
select is(
  (select version from public.items where id = 'c0000000-0000-0000-0000-000000000081'),
  1, 'move does not bump the version');
select is(
  (select updated_by from public.items where id = 'c0000000-0000-0000-0000-000000000081'),
  null, 'move does not stamp updated_by');

-- Note the clamp: x follows the member who moved it.
select is(
  (select (layout ->> 'manual')::boolean from public.items
   where id = 'c0000000-0000-0000-0000-000000000081'),
  true, 'marked manual');

-- NaN / Infinity are rejected (they survive GREATEST/LEAST).
select throws_ok(
  $$select public.set_item_position('c0000000-0000-0000-0000-000000000081', 'NaN'::double precision, 10)$$,
  'P0001', 'invalid_input', 'NaN position rejected');

-- A huge y is capped so one drag can't make the board enormous.
select lives_ok(
  $$select public.set_item_position('c0000000-0000-0000-0000-000000000081', 0.3, 1e9)$$,
  'drag with a huge y is accepted');
select is(
  (select layout ->> 'y' from public.items where id = 'c0000000-0000-0000-0000-000000000081'),
  '20000', 'y is capped');

-- Stranger cannot move.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000083', true);
set role authenticated;
select throws_ok(
  $$select public.set_item_position('c0000000-0000-0000-0000-000000000081', 0.1, 10)$$,
  'P0001', 'not_member', 'stranger cannot move');
reset role;

-- Clearing returns it to the automatic layout.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000081', true);
set role authenticated;
select lives_ok(
  $$select public.set_item_position('c0000000-0000-0000-0000-000000000081', null, null)$$,
  'owner clears the manual spot');
reset role;

select * from finish();
rollback;
