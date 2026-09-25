-- Phase 5: account deletion keeps shared boards and posts.
-- O deletes their account; M is a co-member of a shared board.
begin;
select plan(10);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-000000000061', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000062', 'authenticated', 'authenticated');

-- Board A: O is the only member. Board B: O owner, M member.
insert into public.boards (id, name, created_by) values
  ('b0000000-0000-0000-0000-000000000061', 'Solo', 'a0000000-0000-0000-0000-000000000061'),
  ('b0000000-0000-0000-0000-000000000062', 'Shared', 'a0000000-0000-0000-0000-000000000061');
insert into public.board_members (board_id, user_id, role) values
  ('b0000000-0000-0000-0000-000000000061', 'a0000000-0000-0000-0000-000000000061', 'owner'),
  ('b0000000-0000-0000-0000-000000000062', 'a0000000-0000-0000-0000-000000000061', 'owner'),
  ('b0000000-0000-0000-0000-000000000062', 'a0000000-0000-0000-0000-000000000062', 'member');
insert into public.items (id, board_id, type, body, created_by) values
  ('c0000000-0000-0000-0000-000000000061', 'b0000000-0000-0000-0000-000000000062',
   'note', 'O wrote this', 'a0000000-0000-0000-0000-000000000061');

-- update_profile keeps the avatar unless the clear flag is set.
update public.profiles
set avatar_path = 'a0000000-0000-0000-0000-000000000061/a.jpg'
where id = 'a0000000-0000-0000-0000-000000000061';
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000061', true);
set role authenticated;
select is(
  (select avatar_path from public.update_profile('Renamed')),
  'a0000000-0000-0000-0000-000000000061/a.jpg', 'rename keeps the avatar');
select is(
  (select avatar_path from public.update_profile('Renamed', null, true)),
  null, 'explicit clear removes the avatar');
reset role;

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000061', true);
set role authenticated;
select lives_ok($$select public.delete_account()$$, 'delete_account runs');
reset role;

select is(
  (select count(*)::integer from public.board_members
   where user_id = 'a0000000-0000-0000-0000-000000000061'),
  0, 'caller has no memberships left');
select is(
  (select deleted_at is not null from public.boards where id = 'b0000000-0000-0000-0000-000000000061'),
  true, 'sole-member board soft-deleted');
select is(
  (select deleted_at is null from public.boards where id = 'b0000000-0000-0000-0000-000000000062'),
  true, 'shared board survives');
select is(
  (select role::text from public.board_members
   where board_id = 'b0000000-0000-0000-0000-000000000062'
     and user_id = 'a0000000-0000-0000-0000-000000000062'),
  'owner', 'remaining member promoted to owner');
select is(
  (select avatar_path from public.profiles where id = 'a0000000-0000-0000-0000-000000000061'),
  null, 'avatar cleared');

-- The Edge Function then removes the auth user; profile cascades.
delete from auth.users where id = 'a0000000-0000-0000-0000-000000000061';
select is(
  (select created_by from public.items where id = 'c0000000-0000-0000-0000-000000000061'),
  null, 'post survives with a null author');
select is(
  (select deleted_at is null from public.boards where id = 'b0000000-0000-0000-0000-000000000062'),
  true, 'shared board still alive after auth user removal');

select * from finish();
rollback;
