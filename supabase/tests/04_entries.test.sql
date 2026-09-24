-- Phase 1d: list entry RPCs — positions, ticks, edits, lifetime rule.
-- Roles: O owner, M member, S stranger. Board B2 (O only) for cross-board.
begin;
select plan(37);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-000000000031', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000032', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000033', 'authenticated', 'authenticated');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000031', true);
set role authenticated;
select lives_ok($$select public.create_board('Entries', 'sage')$$, 'board created');
select lives_ok($$select public.create_board('Other', 'sage')$$, 'second board created');
reset role;
create temp table t_b as
  select id from public.boards where name = 'Entries' limit 1;
create temp table t_b2 as
  select id from public.boards where name = 'Other' limit 1;
grant select on t_b to authenticated;
grant select on t_b2 to authenticated;
insert into public.board_members (board_id, user_id, role)
select id, 'a0000000-0000-0000-0000-000000000032', 'member' from t_b;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000031', true);
set role authenticated;
select lives_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000031', (select id from t_b),
    'list', 'paper', null, 'Shop', null, null, null, false,
    '[{"id":"d0000000-0000-0000-0000-000000000031","text":"Milk"}]')$$,
  'post list with one entry');
select lives_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000032', (select id from t_b2),
    'list', 'paper', null, 'Foreign', null, null, null, false, null)$$,
  'post foreign list');
select lives_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000033', (select id from t_b),
    'note', 'butter', 'plain', null, null, null, null, false, null)$$,
  'post plain note');
reset role;

-- add_entry as M.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000032', true);
set role authenticated;
select is(
  (select position::integer from public.add_entry(
    'd0000000-0000-0000-0000-000000000032', 'c0000000-0000-0000-0000-000000000031', 'Eggs')),
  1, 'position follows the max');
select is(
  (select created_by from public.list_entries where id = 'd0000000-0000-0000-0000-000000000032'),
  'a0000000-0000-0000-0000-000000000032', 'entry attributed to adder');
select lives_ok(
  $$select public.add_entry('d0000000-0000-0000-0000-000000000032',
    'c0000000-0000-0000-0000-000000000031', 'Eggs')$$,
  'repost same entry id succeeds');
select is(
  (select count(*)::integer from public.list_entries where id = 'd0000000-0000-0000-0000-000000000032'),
  1, 'no duplicate entry on repost');
select throws_ok(
  $$select public.add_entry('d0000000-0000-0000-0000-000000000033',
    'c0000000-0000-0000-0000-000000000032', 'Sneak')$$,
  'P0001', 'not_member', 'cannot attach to another board''s list');
select throws_ok(
  $$select public.add_entry('d0000000-0000-0000-0000-000000000034',
    'c0000000-0000-0000-0000-000000000033', 'Sneak')$$,
  'P0001', 'invalid_input', 'cannot attach to a note');
select throws_ok(
  $$select public.add_entry('d0000000-0000-0000-0000-000000000035',
    'c0000000-0000-0000-0000-000000000031', '   ')$$,
  'P0001', 'invalid_input', 'blank entry rejected');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000033', true);
set role authenticated;
select throws_ok(
  $$select public.add_entry('d0000000-0000-0000-0000-000000000036',
    'c0000000-0000-0000-0000-000000000031', 'Sneak')$$,
  'P0001', 'not_member', 'stranger cannot add entries');
reset role;

-- Ticks, edits, removal as M.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000032', true);
set role authenticated;
select lives_ok(
  $$select public.set_entry_checked('d0000000-0000-0000-0000-000000000031', true)$$,
  'member ticks');
select ok(
  (select checked_by = 'a0000000-0000-0000-0000-000000000032' and checked_at is not null
   from public.list_entries where id = 'd0000000-0000-0000-0000-000000000031'),
  'tick stamps checker');
select lives_ok(
  $$select public.edit_entry('d0000000-0000-0000-0000-000000000031', 'Oat milk')$$,
  'member edits entry');
select is(
  (select text from public.list_entries where id = 'd0000000-0000-0000-0000-000000000031'),
  'Oat milk', 'edit persists');
select throws_ok(
  $$select public.edit_entry('d0000000-0000-0000-0000-000000000031', '  ')$$,
  'P0001', 'invalid_input', 'blank edit rejected');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000033', true);
set role authenticated;
select throws_ok(
  $$select public.set_entry_checked('d0000000-0000-0000-0000-000000000031', false)$$,
  'P0001', 'not_member', 'stranger cannot tick');
reset role;

-- Lifetime rule: all checked sets +2 days, untick resets to NULL.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000032', true);
set role authenticated;
select ok(
  (select keep_until is null from public.items where id = 'c0000000-0000-0000-0000-000000000031'),
  'partially ticked list keeps NULL');
select lives_ok(
  $$select public.set_entry_checked('d0000000-0000-0000-0000-000000000032', true)$$,
  'tick the last entry');
select ok(
  (select keep_until > now() and keep_until < now() + interval '3 days'
   from public.items where id = 'c0000000-0000-0000-0000-000000000031'),
  'all checked sets 2-day keep');
select lives_ok(
  $$select public.set_entry_checked('d0000000-0000-0000-0000-000000000031', false)$$,
  'untick one entry');
select ok(
  (select keep_until is null from public.items where id = 'c0000000-0000-0000-0000-000000000031'),
  'untick resets keep to NULL');
select lives_ok(
  $$select public.remove_entry('d0000000-0000-0000-0000-000000000032')$$,
  'remove entry');
select is(
  (select count(*)::integer from public.list_entries where id = 'd0000000-0000-0000-0000-000000000032'),
  0, 'entry hard-deleted');
reset role;

-- Ticking entries of a removed list fails.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000031', true);
set role authenticated;
select lives_ok(
  $$select public.remove_item('c0000000-0000-0000-0000-000000000031')$$,
  'remove the list');
select throws_ok(
  $$select public.set_entry_checked('d0000000-0000-0000-0000-000000000031', true)$$,
  'P0001', 'not_found', 'cannot tick entries of a removed list');
reset role;

-- Pinned lists never expire, and a new entry revives a fully-ticked list.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000032', true);
set role authenticated;
select lives_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000094', (select id from t_b),
    'list', 'paper', null, 'Pinned', null, null, null, false,
    '[{"id":"d0000000-0000-0000-0000-000000000094","text":"A"}]')$$,
  'post a list');
select lives_ok(
  $$select public.set_pinned('c0000000-0000-0000-0000-000000000094', true)$$,
  'pin the list');
select lives_ok(
  $$select public.set_entry_checked('d0000000-0000-0000-0000-000000000094', true)$$,
  'tick its only entry');
select ok(
  (select keep_until is null from public.items where id = 'c0000000-0000-0000-0000-000000000094'),
  'a pinned list stays even when fully ticked');
select lives_ok(
  $$select public.set_pinned('c0000000-0000-0000-0000-000000000094', false)$$,
  'unpin the ticked list');
select ok(
  (select keep_until > now() and keep_until < now() + interval '3 days' from public.items
   where id = 'c0000000-0000-0000-0000-000000000094'),
  'unpinning a fully-ticked list gives 2 days');
select lives_ok(
  $$select public.add_entry('d0000000-0000-0000-0000-000000000095',
    'c0000000-0000-0000-0000-000000000094', 'B')$$,
  'add an entry to the ticked list');
select ok(
  (select keep_until is null from public.items where id = 'c0000000-0000-0000-0000-000000000094'),
  'a new entry resets the list to stays');

-- A list can't be given an unbounded number of entries.
select throws_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000096', (select id from t_b),
    'list', 'paper', null, 'Big', null, null, null, false,
    (select jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'text', 'x'))
     from generate_series(1, 501)))$$,
  'P0001', 'invalid_input', 'too many entries in one list rejected');
reset role;

select * from finish();
rollback;
