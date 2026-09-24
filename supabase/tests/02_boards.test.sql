-- Phase 1d: board RPCs — roles, validation, ownership transfer, cleanup.
-- Roles: O owner, M member, S stranger, R rate-limit probe.
begin;
select plan(47);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-000000000011', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000012', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000013', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000014', 'authenticated', 'authenticated');
-- The local seed creates an `invite` key; replace it for this rolled-back run.
delete from vault.secrets where name = 'invite';
select vault.create_secret('test-invite-key-0123456789abcdef', 'invite');

-- create_board as O.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', true);
set role authenticated;
select is((select name from public.create_board('Club', 'blue')), 'Club', 'create_board returns the board');
select is(
  (select role::text from public.board_members where user_id = 'a0000000-0000-0000-0000-000000000011'),
  'owner', 'creator is owner');
select throws_ok($$select public.create_board('   ', 'blue')$$, 'P0001', 'invalid_input', 'blank name rejected');
select throws_ok($$select public.create_board('x', 'neon')$$, 'P0001', 'invalid_input', 'bad color rejected');
reset role;
create temp table t_b1 as
  select id from public.boards where name = 'Club' and created_by = 'a0000000-0000-0000-0000-000000000011' limit 1;
grant select on t_b1 to authenticated;

-- create_board rate limit: 10 per hour for a fresh user.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000014', true);
set role authenticated;
select lives_ok($$select public.create_board('r1')$$, 'rate probe 1');
select lives_ok($$select public.create_board('r2')$$, 'rate probe 2');
select lives_ok($$select public.create_board('r3')$$, 'rate probe 3');
select lives_ok($$select public.create_board('r4')$$, 'rate probe 4');
select lives_ok($$select public.create_board('r5')$$, 'rate probe 5');
select lives_ok($$select public.create_board('r6')$$, 'rate probe 6');
select lives_ok($$select public.create_board('r7')$$, 'rate probe 7');
select lives_ok($$select public.create_board('r8')$$, 'rate probe 8');
select lives_ok($$select public.create_board('r9')$$, 'rate probe 9');
select lives_ok($$select public.create_board('r10')$$, 'rate probe 10');
select throws_ok($$select public.create_board('r11')$$, 'P0001', 'rate_limited', '11th board in an hour is rate-limited');
reset role;

-- rename_board on B1.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', true);
set role authenticated;
select lives_ok(
  $$select public.rename_board((select id from t_b1), 'Clubhouse', 'clay')$$,
  'owner renames');
select is(
  (select name from public.boards where id = (select id from t_b1)),
  'Clubhouse', 'rename persisted');
select throws_ok(
  $$select public.rename_board((select id from t_b1), 'x', 'neon')$$,
  'P0001', 'invalid_input', 'rename with bad color');
select throws_ok(
  $$select public.rename_board('b0000000-0000-0000-0000-000000000099', 'Ghost', 'clay')$$,
  'P0001', 'not_found', 'rename of missing board');
reset role;
insert into public.board_members (board_id, user_id, role)
select id, 'a0000000-0000-0000-0000-000000000012', 'member' from t_b1;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000012', true);
set role authenticated;
select throws_ok(
  $$select public.rename_board((select id from t_b1), 'Sneak', 'clay')$$,
  'P0001', 'not_owner', 'member cannot rename');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000013', true);
set role authenticated;
select throws_ok(
  $$select public.rename_board((select id from t_b1), 'Sneak', 'clay')$$,
  'P0001', 'not_member', 'non-member cannot rename');
reset role;

-- delete_board on B1.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000012', true);
set role authenticated;
select throws_ok(
  $$select public.delete_board((select id from t_b1))$$,
  'P0001', 'not_owner', 'member cannot delete');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000013', true);
set role authenticated;
select throws_ok(
  $$select public.delete_board((select id from t_b1))$$,
  'P0001', 'not_member', 'non-member cannot delete');
select throws_ok(
  $$select public.delete_board('b0000000-0000-0000-0000-000000000099')$$,
  'P0001', 'not_found', 'delete of missing board');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', true);
set role authenticated;
select lives_ok(
  $$select public.get_invite_link((select id from t_b1))$$,
  'invite issued for revoke check');
select lives_ok(
  $$select public.delete_board((select id from t_b1))$$,
  'owner deletes');
reset role;
select is(
  (select deleted_at is not null from public.boards where id = (select id from t_b1)),
  true, 'board soft-deleted');
select is(
  (select count(*)::integer from public.invites
   where board_id = (select id from t_b1) and revoked_at is not null),
  1, 'board invite revoked on delete');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', true);
set role authenticated;
select lives_ok(
  $$select public.delete_board((select id from t_b1))$$,
  'delete is idempotent');
reset role;

-- leave_board promotion on B3 (O owner, M member; O leaves).
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', true);
set role authenticated;
select lives_ok($$select public.create_board('Third', 'sage')$$, 'third board created');
reset role;
create temp table t_b3 as
  select id from public.boards where name = 'Third' and created_by = 'a0000000-0000-0000-0000-000000000011' limit 1;
grant select on t_b3 to authenticated;
insert into public.board_members (board_id, user_id, role)
select id, 'a0000000-0000-0000-0000-000000000012', 'member' from t_b3;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', true);
set role authenticated;
select lives_ok(
  $$select public.leave_board((select id from t_b3))$$,
  'last owner leaves');
reset role;
select is(
  (select role::text from public.board_members
   where board_id = (select id from t_b3) and user_id = 'a0000000-0000-0000-0000-000000000012'),
  'owner', 'longest-standing member promoted');
select is(
  (select deleted_at is null from public.boards where id = (select id from t_b3)),
  true, 'board survives with new owner');
reset role;

-- leave_board on B2: member leaves (board alive), then last member leaves (soft-delete).
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', true);
set role authenticated;
select lives_ok($$select public.create_board('Second', 'sage')$$, 'second board created');
reset role;
create temp table t_b2 as
  select id from public.boards where name = 'Second' and created_by = 'a0000000-0000-0000-0000-000000000011' limit 1;
grant select on t_b2 to authenticated;
insert into public.board_members (board_id, user_id, role)
select id, 'a0000000-0000-0000-0000-000000000012', 'member' from t_b2;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000012', true);
set role authenticated;
select lives_ok(
  $$select public.leave_board((select id from t_b2))$$,
  'member leaves');
reset role;
select is(
  (select count(*)::integer from public.board_members where board_id = (select id from t_b2)),
  1, 'one membership remains');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', true);
set role authenticated;
select lives_ok(
  $$select public.leave_board((select id from t_b2))$$,
  'last member leaves');
reset role;
select is(
  (select deleted_at is not null from public.boards where id = (select id from t_b2)),
  true, 'empty board soft-deleted');
select throws_ok(
  $$select public.leave_board((select id from t_b2))$$,
  'P0001', 'not_member', 'cannot leave twice');
reset role;

-- remove_member on B4 (O owner, M member).
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', true);
set role authenticated;
select lives_ok($$select public.create_board('Fourth', 'sage')$$, 'fourth board created');
reset role;
create temp table t_b4 as
  select id from public.boards where name = 'Fourth' and created_by = 'a0000000-0000-0000-0000-000000000011' limit 1;
grant select on t_b4 to authenticated;
insert into public.board_members (board_id, user_id, role)
select id, 'a0000000-0000-0000-0000-000000000012', 'member' from t_b4;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000012', true);
set role authenticated;
select throws_ok(
  $$select public.remove_member((select id from t_b4), 'a0000000-0000-0000-0000-000000000011')$$,
  'P0001', 'not_owner', 'member cannot remove');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', true);
set role authenticated;
select throws_ok(
  $$select public.remove_member((select id from t_b4), 'a0000000-0000-0000-0000-000000000011')$$,
  'P0001', 'invalid_input', 'cannot remove yourself');
select lives_ok(
  $$select public.get_invite_link((select id from t_b4))$$,
  'invite issued before removing the member');
select lives_ok(
  $$select public.remove_member((select id from t_b4), 'a0000000-0000-0000-0000-000000000012')$$,
  'owner removes member');
reset role;
select is(
  (select count(*)::integer from public.invites
   where board_id = (select id from t_b4) and revoked_at is not null),
  1, 'removing a member revokes the active invite');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000011', true);
set role authenticated;
select is(
  (select count(*)::integer from public.board_members where board_id = (select id from t_b4)),
  1, 'target membership gone');
select throws_ok(
  $$select public.remove_member((select id from t_b4), 'a0000000-0000-0000-0000-000000000012')$$,
  'P0001', 'not_found', 'removing a non-member fails');
reset role;

select * from finish();
rollback;
