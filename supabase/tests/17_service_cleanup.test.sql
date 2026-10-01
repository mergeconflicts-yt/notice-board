-- cleanup_anonymous_user: the nightly cleanup job's service-only RPC.
-- Regression: the job used to delete auth users directly, orphaning boards
-- (memberships cascade away, board left undeleted) and skipping avatar
-- cleanup. The RPC now runs the same board tidy-up as delete_account first.
begin;
select plan(19);

insert into auth.users (id, aud, role, is_anonymous, last_sign_in_at) values
  ('a0000000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated', true,  now() - interval '100 days'),
  ('a0000000-0000-0000-0000-0000000000d2', 'authenticated', 'authenticated', true,  now() - interval '100 days'),
  ('a0000000-0000-0000-0000-0000000000d3', 'authenticated', 'authenticated', true,  now() - interval '100 days'),
  ('a0000000-0000-0000-0000-0000000000d4', 'authenticated', 'authenticated', true,  now() - interval '100 days'),
  ('a0000000-0000-0000-0000-0000000000d5', 'authenticated', 'authenticated', true,  now()),
  ('a0000000-0000-0000-0000-0000000000d6', 'authenticated', 'authenticated', false, now() - interval '100 days'),
  ('a0000000-0000-0000-0000-0000000000d9', 'authenticated', 'authenticated', false, now());
insert into public.boards (id, name, created_by) values
  ('b0000000-0000-0000-0000-0000000000d2', 'Sole', 'a0000000-0000-0000-0000-0000000000d2'),
  ('b0000000-0000-0000-0000-0000000000d3', 'Shared', 'a0000000-0000-0000-0000-0000000000d3'),
  ('b0000000-0000-0000-0000-0000000000d4', 'Kept', 'a0000000-0000-0000-0000-0000000000d9');
insert into public.board_members (board_id, user_id, role) values
  ('b0000000-0000-0000-0000-0000000000d2', 'a0000000-0000-0000-0000-0000000000d2', 'owner'),
  ('b0000000-0000-0000-0000-0000000000d3', 'a0000000-0000-0000-0000-0000000000d3', 'owner'),
  ('b0000000-0000-0000-0000-0000000000d3', 'a0000000-0000-0000-0000-0000000000d9', 'member'),
  ('b0000000-0000-0000-0000-0000000000d4', 'a0000000-0000-0000-0000-0000000000d9', 'owner'),
  ('b0000000-0000-0000-0000-0000000000d4', 'a0000000-0000-0000-0000-0000000000d4', 'member');
update public.profiles set avatar_path = 'a0000000-0000-0000-0000-0000000000d1/old.jpg'
where id = 'a0000000-0000-0000-0000-0000000000d1';
insert into public.invites (board_id, token_hash, code_hash, secret_enc) values
  ('b0000000-0000-0000-0000-0000000000d2',
   extensions.gen_random_bytes(16), extensions.gen_random_bytes(16), extensions.gen_random_bytes(16));

-- Service role only.
select ok(has_function_privilege('service_role', 'public.cleanup_anonymous_user(uuid)', 'execute'),
  'service_role can run cleanup_anonymous_user');
select ok(not has_function_privilege('authenticated', 'public.cleanup_anonymous_user(uuid)', 'execute'),
  'authenticated cannot run cleanup_anonymous_user');
select ok(not has_function_privilege('anon', 'public.cleanup_anonymous_user(uuid)', 'execute'),
  'anon cannot run cleanup_anonymous_user');

set role service_role;

-- A: memberless inactive anonymous user -> cleaned, avatar cleared.
select is(public.cleanup_anonymous_user('a0000000-0000-0000-0000-0000000000d1'), true,
  'memberless inactive anon is cleaned');
reset role;
select is(
  (select avatar_path from public.profiles where id = 'a0000000-0000-0000-0000-0000000000d1'),
  null, 'cleaned user avatar is cleared');

-- B: sole-member owner -> board soft-deleted, invite revoked, membership gone.
set role service_role;
select is(public.cleanup_anonymous_user('a0000000-0000-0000-0000-0000000000d2'), true,
  'sole-member owner is cleaned');
reset role;
select ok(
  (select deleted_at is not null from public.boards where id = 'b0000000-0000-0000-0000-0000000000d2'),
  'memberless board is soft-deleted');
select ok(
  (select revoked_at is not null from public.invites where board_id = 'b0000000-0000-0000-0000-0000000000d2'),
  'board invite is revoked');
select is(
  (select count(*)::integer from public.board_members where board_id = 'b0000000-0000-0000-0000-0000000000d2'),
  0, 'memberships removed');

-- C: last owner of a shared board -> board survives, remaining member promoted.
set role service_role;
select is(public.cleanup_anonymous_user('a0000000-0000-0000-0000-0000000000d3'), true,
  'last owner of a shared board is cleaned');
reset role;
select ok(
  (select deleted_at is null from public.boards where id = 'b0000000-0000-0000-0000-0000000000d3'),
  'shared board is not deleted');
select is(
  (select role::text from public.board_members
   where board_id = 'b0000000-0000-0000-0000-0000000000d3'
     and user_id = 'a0000000-0000-0000-0000-0000000000d9'),
  'owner', 'remaining member is promoted to owner');
select is(
  (select count(*)::integer from public.board_members
   where board_id = 'b0000000-0000-0000-0000-0000000000d3'
     and user_id = 'a0000000-0000-0000-0000-0000000000d3'),
  0, 'target membership removed');

-- D: plain member -> removed, existing owner and board untouched.
set role service_role;
select is(public.cleanup_anonymous_user('a0000000-0000-0000-0000-0000000000d4'), true,
  'plain member is cleaned');
reset role;
select is(
  (select count(*)::integer from public.board_members where board_id = 'b0000000-0000-0000-0000-0000000000d4'),
  1, 'only the owner remains on the board');
select is(
  (select role::text from public.board_members
   where board_id = 'b0000000-0000-0000-0000-0000000000d4'
     and user_id = 'a0000000-0000-0000-0000-0000000000d9'),
  'owner', 'existing owner is unchanged');

-- E/F/H: active, non-anonymous and unknown ids are left alone.
set role service_role;
select is(public.cleanup_anonymous_user('a0000000-0000-0000-0000-0000000000d5'), false,
  'active anonymous user is untouched');
select is(public.cleanup_anonymous_user('a0000000-0000-0000-0000-0000000000d6'), false,
  'non-anonymous user is untouched');
select is(public.cleanup_anonymous_user('a0000000-0000-0000-0000-0000000000ff'), false,
  'unknown id is untouched');
reset role;

select * from finish();
rollback;
