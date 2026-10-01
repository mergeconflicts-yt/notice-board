-- keep_cycle: authorization + the wrap-around Keep behaviour.
-- O owns the board, M is a member, S is a stranger.
-- Regression: keep_cycle was executable by authenticated but missing from the
-- 10_privileges allowlist, and repeated Keep taps dead-ended at the 30-day cap.
begin;
select plan(19);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-0000000000c3', 'authenticated', 'authenticated');
insert into public.boards (id, name, created_by)
values ('b0000000-0000-0000-0000-0000000000c1', 'Keep', 'a0000000-0000-0000-0000-0000000000c1');
insert into public.board_members (board_id, user_id, role) values
  ('b0000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-0000000000c1', 'owner'),
  ('b0000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-0000000000c2', 'member');
insert into public.items (id, board_id, type, body, title, event_at, pinned, keep_until, deleted_at, created_by) values
  ('c0000000-0000-0000-0000-0000000000c1', 'b0000000-0000-0000-0000-0000000000c1',
   'note', 'keep me', null, null, false, now() + interval '7 days', null, 'a0000000-0000-0000-0000-0000000000c1'),
  ('c0000000-0000-0000-0000-0000000000c2', 'b0000000-0000-0000-0000-0000000000c1',
   'note', 'pinned', null, null, true, null, null, 'a0000000-0000-0000-0000-0000000000c1'),
  ('c0000000-0000-0000-0000-0000000000c3', 'b0000000-0000-0000-0000-0000000000c1',
   'list', null, 'Tasks', null, false, null, null, 'a0000000-0000-0000-0000-0000000000c1'),
  ('c0000000-0000-0000-0000-0000000000c4', 'b0000000-0000-0000-0000-0000000000c1',
   'note', 'gone', null, null, false, now() + interval '7 days', now(), 'a0000000-0000-0000-0000-0000000000c1'),
  ('c0000000-0000-0000-0000-0000000000c5', 'b0000000-0000-0000-0000-0000000000c1',
   'date', null, 'Next year', '2027-06-01T10:00:00Z', false,
   '2027-06-02T00:00:00+00', null, 'a0000000-0000-0000-0000-0000000000c1');

-- Anon has no EXECUTE grant at all.
set role anon;
select throws_ok(
  $$select public.keep_cycle('c0000000-0000-0000-0000-0000000000c1')$$,
  '42501', null, 'anon cannot keep_cycle');
reset role;

-- A stranger cannot keep a board's post.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000c3', true);
set role authenticated;
select throws_ok(
  $$select public.keep_cycle('c0000000-0000-0000-0000-0000000000c1')$$,
  'P0001', 'not_member', 'stranger cannot keep_cycle');
reset role;

-- A member is allowed; guards first.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000c2', true);
set role authenticated;
select throws_ok(
  $$select public.keep_cycle('c0000000-0000-0000-0000-0000000000ff')$$,
  'P0001', 'not_found', 'missing item is not_found');
select throws_ok(
  $$select public.keep_cycle('c0000000-0000-0000-0000-0000000000c2')$$,
  'P0001', 'invalid_input', 'pinned item cannot keep_cycle');
select throws_ok(
  $$select public.keep_cycle('c0000000-0000-0000-0000-0000000000c3')$$,
  'P0001', 'invalid_input', 'list cannot keep_cycle');
select throws_ok(
  $$select public.keep_cycle('c0000000-0000-0000-0000-0000000000c4')$$,
  'P0001', 'not_found', 'removed item cannot keep_cycle');

-- Three taps extend +7 days each (7 -> 14 -> 21 -> 28).
select lives_ok(
  $$select public.keep_cycle('c0000000-0000-0000-0000-0000000000c1')$$, 'first keep');
select ok(
  (select keep_until > now() + interval '13 days' and keep_until < now() + interval '15 days'
   from public.items where id = 'c0000000-0000-0000-0000-0000000000c1'),
  'first keep extends to ~14 days');
select lives_ok(
  $$select public.keep_cycle('c0000000-0000-0000-0000-0000000000c1')$$, 'second keep');
select ok(
  (select keep_until > now() + interval '20 days' and keep_until < now() + interval '22 days'
   from public.items where id = 'c0000000-0000-0000-0000-0000000000c1'),
  'second keep extends to ~21 days');
select lives_ok(
  $$select public.keep_cycle('c0000000-0000-0000-0000-0000000000c1')$$, 'third keep');
select ok(
  (select keep_until > now() + interval '27 days' and keep_until < now() + interval '29 days'
   from public.items where id = 'c0000000-0000-0000-0000-0000000000c1'),
  'third keep extends to ~28 days');

-- The fourth tap no longer fits under now()+30d, so it wraps back to the
-- type's standard 7-day lifetime instead of dead-ending at the cap.
select lives_ok(
  $$select public.keep_cycle('c0000000-0000-0000-0000-0000000000c1')$$, 'fourth keep wraps');
select ok(
  (select keep_until > now() + interval '6 days' and keep_until < now() + interval '8 days'
   from public.items where id = 'c0000000-0000-0000-0000-0000000000c1'),
  'fourth keep wraps to the standard lifetime');
select is(
  (select version from public.items where id = 'c0000000-0000-0000-0000-0000000000c1'),
  5, 'each keep bumps the version');

-- The cycle repeats.
select lives_ok(
  $$select public.keep_cycle('c0000000-0000-0000-0000-0000000000c1')$$, 'fifth keep');
select ok(
  (select keep_until > now() + interval '13 days' and keep_until < now() + interval '15 days'
   from public.items where id = 'c0000000-0000-0000-0000-0000000000c1'),
  'fifth keep repeats the cycle');

-- A far-future date whose default lies beyond the cap is never shortened.
select lives_ok(
  $$select public.keep_cycle('c0000000-0000-0000-0000-0000000000c5')$$, 'far-future date keep');
select is(
  (select keep_until from public.items where id = 'c0000000-0000-0000-0000-0000000000c5'),
  '2027-06-02T00:00:00+00'::timestamptz, 'far-future date is preserved');

reset role;

select * from finish();
rollback;
