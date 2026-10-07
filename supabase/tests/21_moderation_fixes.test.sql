-- Moderation follow-ups (migration 20261007000022_moderation_fixes):
-- restore_item is deleter-or-owner only, and board_can_use requires caller
-- membership. Roles: O owner, M1/M2 members, S stranger.
begin;
select plan(9);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-0000000000b3', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-0000000000b4', 'authenticated', 'authenticated');
insert into public.boards (id, name, created_by)
values ('b0000000-0000-0000-0000-0000000000b1', 'Fridge', 'a0000000-0000-0000-0000-0000000000b1');
insert into public.board_members (board_id, user_id, role) values
  ('b0000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-0000000000b1', 'owner'),
  ('b0000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-0000000000b2', 'member'),
  ('b0000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-0000000000b3', 'member');
insert into public.items (id, board_id, type, body, created_by)
values ('c0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-0000000000b1',
        'note', 'member note', 'a0000000-0000-0000-0000-0000000000b2');

-- Owner removes a member's post: uninvolved members cannot restore it.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000b1', true);
set role authenticated;
select lives_ok(
  $$select public.remove_item('c0000000-0000-0000-0000-0000000000b1')$$,
  'owner removes a member''s post');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000b3', true);
set role authenticated;
select throws_ok(
  $$select public.restore_item('c0000000-0000-0000-0000-0000000000b1')$$,
  'P0001', 'not_allowed', 'uninvolved member cannot restore the owner''s moderation');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000b2', true);
set role authenticated;
select throws_ok(
  $$select public.restore_item('c0000000-0000-0000-0000-0000000000b1')$$,
  'P0001', 'not_allowed', 'author cannot restore a post the owner removed');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000b1', true);
set role authenticated;
select lives_ok(
  $$select public.restore_item('c0000000-0000-0000-0000-0000000000b1')$$,
  'owner restores');
reset role;

-- The deleter path still works: a member removes their own post and brings
-- it back, while another member cannot.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000b2', true);
set role authenticated;
select lives_ok(
  $$select public.remove_item('c0000000-0000-0000-0000-0000000000b1')$$,
  'author removes their own post');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000b3', true);
set role authenticated;
select throws_ok(
  $$select public.restore_item('c0000000-0000-0000-0000-0000000000b1')$$,
  'P0001', 'not_allowed', 'another member cannot restore the author''s removal');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000b2', true);
set role authenticated;
select lives_ok(
  $$select public.restore_item('c0000000-0000-0000-0000-0000000000b1')$$,
  'deleter restores their own removal');
reset role;

-- board_can_use requires caller membership: a stranger learns nothing about
-- the board's entitlements, a member still sees the free pack.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000b4', true);
set role authenticated;
select is(public.board_can_use('b0000000-0000-0000-0000-0000000000b1', 'starter'),
  false, 'stranger cannot probe pack entitlements');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000b2', true);
set role authenticated;
select is(public.board_can_use('b0000000-0000-0000-0000-0000000000b1', 'starter'),
  true, 'member still sees the free pack');
reset role;

select * from finish();
rollback;
