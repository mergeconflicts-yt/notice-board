-- Safety surfaces: report flow, owner queue, block list (store guideline 1.2).
-- O owns a board; M is a member; S is a stranger.
begin;
select plan(29);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-000000000091', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000092', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000093', 'authenticated', 'authenticated');
insert into public.boards (id, name, created_by)
values ('b0000000-0000-0000-0000-000000000091', 'Safety', 'a0000000-0000-0000-0000-000000000091');
insert into public.board_members (board_id, user_id, role) values
  ('b0000000-0000-0000-0000-000000000091', 'a0000000-0000-0000-0000-000000000091', 'owner'),
  ('b0000000-0000-0000-0000-000000000091', 'a0000000-0000-0000-0000-000000000092', 'member');
insert into public.items (id, board_id, type, body, created_by) values
  ('c0000000-0000-0000-0000-000000000091', 'b0000000-0000-0000-0000-000000000091',
   'note', 'reported note', 'a0000000-0000-0000-0000-000000000091');

-- M reports the post (idempotent per reporter/item).
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000092', true);
set role authenticated;
select lives_ok(
  $$select public.report_post('c0000000-0000-0000-0000-000000000091', 'rude')$$,
  'member reports a post');
select lives_ok(
  $$select public.report_post('c0000000-0000-0000-0000-000000000091', 'rude')$$,
  'repeat report is a no-op');
reset role;
select is(
  (select count(*)::integer from public.post_reports
   where item_id = 'c0000000-0000-0000-0000-000000000091'),
  1, 'one report row per reporter/item');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000092', true);
set role authenticated;

-- O reports too; the queue shows the post once with count 2.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000091', true);
select lives_ok(
  $$select public.report_post('c0000000-0000-0000-0000-000000000091')$$,
  'owner reports without a reason');
select is(
  (select count(*)::integer from public.list_reported_items('b0000000-0000-0000-0000-000000000091')),
  1, 'queue lists the reported post');
select is(
  (select report_count from public.list_reported_items('b0000000-0000-0000-0000-000000000091')),
  2, 'queue counts both reports');
reset role;

-- M (not owner) cannot see the queue or dismiss.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000092', true);
set role authenticated;
select throws_ok(
  $$select public.list_reported_items('b0000000-0000-0000-0000-000000000091')$$,
  'P0001', 'not_owner', 'member cannot list reports');
select throws_ok(
  $$select public.dismiss_reports('c0000000-0000-0000-0000-000000000091')$$,
  'P0001', 'not_owner', 'member cannot dismiss reports');
select throws_ok(
  $$select public.block_member('b0000000-0000-0000-0000-000000000091',
    'a0000000-0000-0000-0000-000000000091')$$,
  'P0001', 'not_owner', 'member cannot block');
select throws_ok(
  $$select public.list_blocked('b0000000-0000-0000-0000-000000000091')$$,
  'P0001', 'not_owner', 'member cannot list blocks');
reset role;

-- S cannot report or list.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000093', true);
set role authenticated;
select throws_ok(
  $$select public.report_post('c0000000-0000-0000-0000-000000000091')$$,
  'P0001', 'not_member', 'stranger cannot report');
select throws_ok(
  $$select public.list_reported_items('b0000000-0000-0000-0000-000000000091')$$,
  'P0001', 'not_member', 'stranger cannot list reports');
select throws_ok(
  $$select public.block_member('b0000000-0000-0000-0000-000000000091',
    'a0000000-0000-0000-0000-000000000092')$$,
  'P0001', 'not_member', 'stranger cannot block');
reset role;

-- Anon can do nothing.
set role anon;
select throws_ok(
  $$select public.report_post('c0000000-0000-0000-0000-000000000091')$$,
  '42501', null, 'anon cannot report');
select throws_ok(
  $$select public.block_member('b0000000-0000-0000-0000-000000000091',
    'a0000000-0000-0000-0000-000000000092')$$,
  '42501', null, 'anon cannot block');
reset role;

-- O dismisses; the queue empties.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000091', true);
set role authenticated;
select lives_ok(
  $$select public.dismiss_reports('c0000000-0000-0000-0000-000000000091')$$,
  'owner dismisses reports');
select is(
  (select count(*)::integer from public.list_reported_items('b0000000-0000-0000-0000-000000000091')),
  0, 'queue empty after dismiss');

-- O blocks M: membership gone, block recorded.
select lives_ok(
  $$select public.block_member('b0000000-0000-0000-0000-000000000091',
    'a0000000-0000-0000-0000-000000000092')$$,
  'owner blocks a member');
select is(
  (select count(*)::integer from public.board_members
   where board_id = 'b0000000-0000-0000-0000-000000000091'
     and user_id = 'a0000000-0000-0000-0000-000000000092'),
  0, 'blocked member loses membership');
select is(
  (select count(*)::integer from public.list_blocked('b0000000-0000-0000-0000-000000000091')),
  1, 'block list shows the blocked user');
reset role;

-- M cannot rejoin while blocked, even with a fresh link. Mint one as O first.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000091', true);
set role authenticated;
create temp table t_fresh_link as
  select token from public.get_invite_link('b0000000-0000-0000-0000-000000000091');
reset role;
grant select on t_fresh_link to authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000092', true);
set role authenticated;
select is(
  (select public.accept_invite((select token from t_fresh_link))),
  null, 'blocked member cannot rejoin with a fresh link');
reset role;

-- O unblocks; the fresh link now works (unblock itself does not re-add).
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000091', true);
set role authenticated;
select lives_ok(
  $$select public.unblock_member('b0000000-0000-0000-0000-000000000091',
    'a0000000-0000-0000-0000-000000000092')$$,
  'owner unblocks');
select is(
  (select count(*)::integer from public.list_blocked('b0000000-0000-0000-0000-000000000091')),
  0, 'block list empty after unblock');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000092', true);
set role authenticated;
select is(
  (select public.accept_invite((select token from t_fresh_link))),
  'b0000000-0000-0000-0000-000000000091', 'unblocked member rejoins with a fresh link');
reset role;

-- Soft-delete the board: the safety RPCs die with it even though memberships
-- linger for the purge job.
update public.boards set deleted_at = now()
where id = 'b0000000-0000-0000-0000-000000000091';
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000091', true);
set role authenticated;
select throws_ok(
  $$select public.list_reported_items('b0000000-0000-0000-0000-000000000091')$$,
  'P0001', 'not_member', 'report queue refused on a deleted board');
select throws_ok(
  $$select public.dismiss_reports('c0000000-0000-0000-0000-000000000091')$$,
  'P0001', 'not_member', 'dismiss refused on a deleted board');
select throws_ok(
  $$select public.list_blocked('b0000000-0000-0000-0000-000000000091')$$,
  'P0001', 'not_member', 'block list refused on a deleted board');
select throws_ok(
  $$select public.unblock_member('b0000000-0000-0000-0000-000000000091',
    'a0000000-0000-0000-0000-000000000092')$$,
  'P0001', 'not_member', 'unblock refused on a deleted board');
select throws_ok(
  $$select public.report_post('c0000000-0000-0000-0000-000000000091')$$,
  'P0001', 'not_member', 'report refused on a deleted board');
reset role;

select * from finish();
rollback;
