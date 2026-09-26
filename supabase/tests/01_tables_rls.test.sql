-- Phase 1d: direct table access is closed; reads are member-scoped.
-- Roles: O owner, M member, S stranger (all authenticated), plus anon.
begin;
select plan(32);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated');
insert into public.boards (id, name, created_by)
values ('b0000000-0000-0000-0000-000000000001', 'Club', 'a0000000-0000-0000-0000-000000000001');
insert into public.board_members (board_id, user_id, role) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'member');
insert into public.items (id, board_id, type, body, created_by)
values ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'note', 'hello', 'a0000000-0000-0000-0000-000000000001');
insert into public.list_entries (id, item_id, board_id, text, position, created_by)
values ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'x', 0, 'a0000000-0000-0000-0000-000000000001');

-- anon: nothing is reachable, not even reads.
set role anon;
select throws_ok($$select * from public.boards$$, '42501', 'permission denied for table boards', 'anon cannot select boards');
select throws_ok($$insert into public.boards (name) values ('x')$$, '42501', 'permission denied for table boards', 'anon cannot insert boards');
select throws_ok($$select public.create_board('x')$$, '42501', null, 'anon cannot call functions');
reset role;

-- stranger: zero rows everywhere, zero writes.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', true);
set role authenticated;
select is((select count(*)::integer from public.boards), 0, 'stranger sees no boards');
select is((select count(*)::integer from public.items), 0, 'stranger sees no items');
select is((select count(*)::integer from public.list_entries), 0, 'stranger sees no entries');
select is((select count(*)::integer from public.board_members), 0, 'stranger sees no memberships');
select throws_ok(
  $$insert into public.items (id, board_id, type, body) values ('c0000000-0000-0000-0000-000000000099', 'b0000000-0000-0000-0000-000000000001', 'note', 'sneak')$$,
  '42501', 'permission denied for table items', 'stranger cannot insert items');
select throws_ok(
  $$update public.items set body = 'sneak' where id = 'c0000000-0000-0000-0000-000000000001'$$,
  '42501', 'permission denied for table items', 'stranger cannot update items');
select throws_ok(
  $$delete from public.items where id = 'c0000000-0000-0000-0000-000000000001'$$,
  '42501', 'permission denied for table items', 'stranger cannot delete items');
select throws_ok(
  $$insert into public.board_members (board_id, user_id) values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003')$$,
  '42501', 'permission denied for table board_members', 'stranger cannot self-join');
select throws_ok(
  $$delete from public.board_members where board_id = 'b0000000-0000-0000-0000-000000000001'$$,
  '42501', 'permission denied for table board_members', 'stranger cannot delete memberships');
select throws_ok(
  $$update public.boards set name = 'sneak' where id = 'b0000000-0000-0000-0000-000000000001'$$,
  '42501', 'permission denied for table boards', 'stranger cannot update boards');
select throws_ok($$select * from public.invites$$, '42501', 'permission denied for table invites', 'members cannot read invites table');
select throws_ok($$select * from public.rate_limits$$, '42501', 'permission denied for table rate_limits', 'members cannot read rate_limits');
select throws_ok(
  $$insert into public.profiles (id, display_name) values ('a0000000-0000-0000-0000-000000000099', 'Fake')$$,
  '42501', 'permission denied for table profiles', 'stranger cannot insert profiles');
select is(
  (select count(*)::integer from public.profiles where id = 'a0000000-0000-0000-0000-000000000001'),
  0, 'stranger cannot read other profiles');
reset role;

-- member: reads work, writes stay closed.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
set role authenticated;
select is((select count(*)::integer from public.boards), 1, 'member reads board');
select is((select count(*)::integer from public.items), 1, 'member reads items');
select is(
  (select layout from public.visible_items where id = 'c0000000-0000-0000-0000-000000000001'),
  null, 'view exposes the layout column');
select is(
  (select count(*)::integer from public.profiles where id = 'a0000000-0000-0000-0000-000000000001'),
  1, 'member reads co-member profile');
select throws_ok(
  $$update public.items set body = 'sneak' where id = 'c0000000-0000-0000-0000-000000000001'$$,
  '42501', 'permission denied for table items', 'member cannot update items directly');
reset role;

-- owner: own profile readable, profile writes closed.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
set role authenticated;
select is(
  (select count(*)::integer from public.profiles where id = 'a0000000-0000-0000-0000-000000000001'),
  1, 'own profile readable');
select throws_ok(
  $$update public.profiles set display_name = 'x' where id = 'a0000000-0000-0000-0000-000000000001'$$,
  '42501', 'permission denied for table profiles', 'owner cannot update profiles directly');
reset role;

-- A soft-deleted board keeps its memberships, but they no longer expose
-- anything: no co-member profiles, no board/items/entries rows.
update public.boards set deleted_at = now()
where id = 'b0000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
set role authenticated;
select is(
  (select count(*)::integer from public.profiles where id = 'a0000000-0000-0000-0000-000000000001'),
  0, 'deleted-board membership exposes no co-member profile');
select is((select count(*)::integer from public.boards), 0, 'deleted board hidden');
select is((select count(*)::integer from public.items), 0, 'deleted-board items hidden');
select is((select count(*)::integer from public.list_entries), 0, 'deleted-board entries hidden');
select is((select count(*)::integer from public.board_members), 0, 'deleted-board memberships hidden');
reset role;

-- Path constraints and supporting indexes exist.
select throws_ok(
  $$insert into public.items (id, board_id, type, body, photo_path) values
    ('c0000000-0000-0000-0000-000000000098', 'b0000000-0000-0000-0000-000000000001',
     'photo', 'x', 'not-a-uuid/path.jpg')$$,
  '23514', null, 'malformed photo_path rejected by the table');
select throws_ok(
  $$update public.profiles set avatar_path = 'nope/x.jpg'
    where id = 'a0000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'malformed avatar_path rejected by the table');
select is(
  (select count(*)::integer from pg_indexes
   where schemaname = 'public'
     and indexname in ('items_board_updated_idx', 'items_board_deleted_idx', 'invites_created_by_idx')),
  3, 'delta/purge/lookup indexes exist');

select * from finish();
rollback;
