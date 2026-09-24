-- Expiry edge cases: board-timezone dates and pinned lists.
begin;
select plan(7);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000c1', true);
set role authenticated;

-- Date expiry uses the board's time zone, not UTC.
select lives_ok(
  $$select public.create_board('Taipei', 'blue', 'Asia/Taipei')$$,
  'create a Taipei board');
create temp table t_taipei as
  select id from public.boards where name = 'Taipei' and created_by = 'a0000000-0000-0000-0000-0000000000c1';
reset role;
grant select on t_taipei to authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000c1', true);
set role authenticated;
select lives_ok(
  $$select public.post_item('c0000000-0000-0000-0000-0000000000c1', (select id from t_taipei),
    'date', 'sky', null, 'Party', '2026-10-02T23:00:00Z', null, null, false, null)$$,
  'post a date at 23:00Z (07:00 Taipei)');
select is(
  (select keep_until from public.items where id = 'c0000000-0000-0000-0000-0000000000c1'),
  '2026-10-03T16:00:00+00'::timestamptz,
  'expires at the next day 00:00 Taipei (16:00Z)');

-- Unknown time zone is rejected.
select throws_ok(
  $$select public.create_board('Bad', 'sage', 'Not/AZone')$$,
  'P0001', 'invalid_input', 'unknown time zone rejected');

-- Pinned list stays forever, even fully ticked; unpin gives 2 days.
select lives_ok(
  $$select public.post_item('c0000000-0000-0000-0000-0000000000c2', (select id from t_taipei),
    'list', 'paper', null, 'Pinned', null, null, null, true,
    '[{"id":"d0000000-0000-0000-0000-0000000000c1","text":"A"}]')$$,
  'post a pinned list');
select lives_ok(
  $$select public.set_entry_checked('d0000000-0000-0000-0000-0000000000c1', true)$$,
  'tick its only entry');
reset role;
select is(
  (select keep_until is null from public.items where id = 'c0000000-0000-0000-0000-0000000000c2'),
  true, 'pinned list never expires when fully ticked');

select * from finish();
rollback;
