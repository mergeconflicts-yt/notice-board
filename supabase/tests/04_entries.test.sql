-- Phase 1d: list entry RPCs — positions, ticks, edits, lifetime rule.
-- Roles: O owner, M member, S stranger. Board B2 (O only) for cross-board.
begin;
select plan(54);

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
-- Re-ticking an already-ticked entry is a no-op: the lifetime must not move.
reset role;
create temp table t_entry_keep as
  select keep_until from public.items where id = 'c0000000-0000-0000-0000-000000000031';
grant select on t_entry_keep to authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000032', true);
set role authenticated;
select lives_ok(
  $$select public.set_entry_checked('d0000000-0000-0000-0000-000000000031', true)$$,
  're-tick an already-ticked entry');
select is(
  (select keep_until from public.items where id = 'c0000000-0000-0000-0000-000000000031'),
  (select keep_until from t_entry_keep),
  're-tick does not move the list lifetime');
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
select throws_ok(
  $$select public.remove_entry('d0000000-0000-0000-0000-000000000031')$$,
  'P0001', 'not_found', 'cannot remove an entry of a removed list');
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

-- A lifetime change bumps updated_at so delta catch-up reads see it.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000031', true);
set role authenticated;
select lives_ok(
  $$select public.post_item('c0000000-0000-0000-0000-0000000000b1', (select id from t_b),
    'list', 'paper', null, 'Delta', null, null, null, false,
    '[{"id":"d0000000-0000-0000-0000-0000000000b1","text":"x"}]')$$,
  'post a list for the delta test');
reset role;
update public.items
set updated_at = now() - interval '1 hour'
where id = 'c0000000-0000-0000-0000-0000000000b1';
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000032', true);
set role authenticated;
select lives_ok(
  $$select public.set_entry_checked('d0000000-0000-0000-0000-0000000000b1', true)$$,
  'tick the only entry');
reset role;
select is(
  (select updated_at > now() - interval '1 minute' from public.items
   where id = 'c0000000-0000-0000-0000-0000000000b1'),
  true, 'a lifetime change bumps updated_at');

-- A retry of an existing entry still succeeds when the list is at the cap.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000031', true);
set role authenticated;
select lives_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000097', (select id from t_b),
    'list', 'paper', null, 'Full', null, null, null, false, null)$$,
  'post a list for the cap-retry test');
reset role;
insert into public.list_entries (id, item_id, board_id, text, position, created_by)
select 'd0000000-0000-0000-0000-000000000097', 'c0000000-0000-0000-0000-000000000097',
       (select id from t_b), 'first', 0, 'a0000000-0000-0000-0000-000000000031';
insert into public.list_entries (id, item_id, board_id, text, position, created_by)
select gen_random_uuid(), 'c0000000-0000-0000-0000-000000000097',
       (select id from t_b), 'filler', g, 'a0000000-0000-0000-0000-000000000031'
from generate_series(1, 499) g;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000032', true);
set role authenticated;
select is(
  (select text from public.add_entry('d0000000-0000-0000-0000-000000000097',
    'c0000000-0000-0000-0000-000000000097', 'changed')),
  'first', 'retry on a full list returns the stored entry');
select throws_ok(
  $$select public.add_entry('d0000000-0000-0000-0000-000000000098',
    'c0000000-0000-0000-0000-000000000097', 'new')$$,
  'P0001', 'invalid_input', 'a new entry on a full list is rejected');
reset role;

-- edit_list: title/colour and all entry changes in one version-checked call.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000031', true);
set role authenticated;
select lives_ok(
  $$select public.post_item('c0000000-0000-0000-0000-0000000000c1', (select id from t_b),
    'list', 'paper', null, 'Batch', null, null, null, false,
    '[{"id":"d0000000-0000-0000-0000-0000000000c1","text":"keep"},
      {"id":"d0000000-0000-0000-0000-0000000000c2","text":"edit"}]')$$,
  'post a list for edit_list');
select lives_ok(
  $$select public.edit_list('c0000000-0000-0000-0000-0000000000c1', 1, 'Batch!', 'sky', 'list notes',
    '[{"id":"d0000000-0000-0000-0000-0000000000c3","text":"added"}]',
    '[{"id":"d0000000-0000-0000-0000-0000000000c2","text":"edited"}]',
    array['d0000000-0000-0000-0000-0000000000c1']::uuid[])$$,
  'edit_list applies all changes');
select is(
  (select string_agg(id || ':' || text, ',' order by text) from public.list_entries
   where item_id = 'c0000000-0000-0000-0000-0000000000c1'),
  'd0000000-0000-0000-0000-0000000000c3:added,d0000000-0000-0000-0000-0000000000c2:edited',
  'entries match the batch');
select is(
  (select title || '/' || color::text || '/' || coalesce(body, '') || '/' || version::text
   from public.items where id = 'c0000000-0000-0000-0000-0000000000c1'),
  'Batch!/sky/list notes/2', 'title/colour/body updated and version bumped');
select throws_ok(
  $$select public.edit_list('c0000000-0000-0000-0000-0000000000c1', 1, 'Stale', 'sky', null, '[]', '[]', '{}')$$,
  'P0001', 'version_conflict', 'stale edit_list rejected');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000032', true);
set role authenticated;
select throws_ok(
  $$select public.edit_list('c0000000-0000-0000-0000-0000000000c1', 2, 'Nope', 'sky', null, '[]', '[]', '{}')$$,
  'P0001', 'not_author', 'non-author cannot edit_list');
reset role;

-- edit_list: remove-ids from another list must not create cap headroom.
insert into public.list_entries (id, item_id, board_id, text, position, created_by)
select gen_random_uuid(), 'c0000000-0000-0000-0000-0000000000c1', (select id from t_b),
       'filler', 1000 + g, 'a0000000-0000-0000-0000-000000000031'
from generate_series(1, 498) g;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000031', true);
set role authenticated;
select throws_ok(
  $$select public.edit_list('c0000000-0000-0000-0000-0000000000c1', 2, 'Full', 'sky', null,
    '[{"id":"d0000000-0000-0000-0000-0000000000c9","text":"sneak"}]', '[]',
    array['e0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000002']::uuid[])$$,
  'P0001', 'invalid_input', 'foreign remove-ids do not bypass the entry cap');
select is(
  (select count(*)::integer from public.list_entries
   where item_id = 'c0000000-0000-0000-0000-0000000000c1'),
  500, 'failed batch leaves the list untouched');
reset role;

select * from finish();
rollback;
