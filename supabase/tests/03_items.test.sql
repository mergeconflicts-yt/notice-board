-- Phase 1d: item RPCs — validation, authorship, versions, lifetimes.
-- Roles: O owner/author, M member, S stranger.
begin;
select plan(47);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-000000000021', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000022', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000023', 'authenticated', 'authenticated');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000021', true);
set role authenticated;
select lives_ok($$select public.create_board('Items', 'sage')$$, 'board created');
reset role;
create temp table t_b as
  select id from public.boards where name = 'Items' limit 1;
grant select on t_b to authenticated;
insert into public.board_members (board_id, user_id, role)
select id, 'a0000000-0000-0000-0000-000000000022', 'member' from t_b;

-- post_item validation and defaults, as O.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000021', true);
set role authenticated;
select lives_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000021', (select id from t_b),
    'note', 'butter', 'hello', null, null, null, null, false, null)$$,
  'post note');
select ok(
  (select keep_until > now() + interval '6 days' and keep_until < now() + interval '8 days'
   from public.items where id = 'c0000000-0000-0000-0000-000000000021'),
  'note keep_until is 7 days');
select is(
  (select created_by from public.items where id = 'c0000000-0000-0000-0000-000000000021'),
  'a0000000-0000-0000-0000-000000000021', 'item attributed to poster');
select throws_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000022', (select id from t_b),
    'note', 'butter', '   ', null, null, null, null, false, null)$$,
  'P0001', 'invalid_input', 'blank note rejected');
select throws_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000023', (select id from t_b),
    'date', 'butter', null, 'Party', null, null, null, false, null)$$,
  'P0001', 'invalid_input', 'dateless date rejected');
select lives_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000024', (select id from t_b),
    'date', 'sky', null, 'Party', '2026-10-02T15:00:00Z', 'Park', null, false, null)$$,
  'post date');
select is(
  (select keep_until from public.items where id = 'c0000000-0000-0000-0000-000000000024'),
  '2026-10-03T00:00:00+00'::timestamptz, 'date keep_until is the day after the event');
select throws_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000025', (select id from t_b),
    'photo', 'paper', 'cap', null, null, null, null, false, null)$$,
  'P0001', 'invalid_input', 'pathless photo rejected');
select throws_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000025', (select id from t_b),
    'photo', 'paper', 'cap', null, null, null, 'other-board/c0000000-0000-0000-0000-000000000025/f.jpg', false, null)$$,
  'P0001', 'invalid_input', 'foreign photo path rejected');
select lives_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000025', (select id from t_b),
    'photo', 'paper', 'cap', null, null, null,
    (select id from t_b) || '/c0000000-0000-0000-0000-000000000025/f.jpg', false, null)$$,
  'post photo');
select ok(
  (select keep_until > now() + interval '13 days' and keep_until < now() + interval '15 days'
   from public.items where id = 'c0000000-0000-0000-0000-000000000025'),
  'photo keep_until is 14 days');
select throws_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000026', (select id from t_b),
    'note', 'butter', 'hi', null, null, null, null, false, '[{"id":"d0000000-0000-0000-0000-000000000021","text":"x"}]')$$,
  'P0001', 'invalid_input', 'entries rejected for non-lists');
select lives_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000021', (select id from t_b),
    'note', 'sky', 'CHANGED', null, null, null, null, false, null)$$,
  'repost with same id succeeds');
select is(
  (select body from public.items where id = 'c0000000-0000-0000-0000-000000000021'),
  'hello', 'first write wins on id reuse');
select is(
  (select count(*)::integer from public.items where id = 'c0000000-0000-0000-0000-000000000021'),
  1, 'no duplicate row on repost');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000023', true);
set role authenticated;
select throws_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000027', (select id from t_b),
    'note', 'butter', 'sneak', null, null, null, null, false, null)$$,
  'P0001', 'not_member', 'stranger cannot post');
reset role;

-- edit_item authorship and versions, as O (author) and M (non-author).
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000022', true);
set role authenticated;
select throws_ok(
  $$select public.edit_item('c0000000-0000-0000-0000-000000000021', 1, 'sneak', null, null, null, 'butter')$$,
  'P0001', 'not_author', 'non-author cannot edit text');
select lives_ok(
  $$select public.set_pinned('c0000000-0000-0000-0000-000000000021', true)$$,
  'non-author can pin');
select lives_ok(
  $$select public.set_pinned('c0000000-0000-0000-0000-000000000021', false)$$,
  'non-author can unpin');
select ok(
  (select pinned = false and keep_until > now() + interval '6 days'
   from public.items where id = 'c0000000-0000-0000-0000-000000000021'),
  'unpin restores the type default');
select throws_ok(
  $$select public.set_done('c0000000-0000-0000-0000-000000000025', true)$$,
  'P0001', 'invalid_input', 'photos cannot be marked done');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000021', true);
set role authenticated;
select lives_ok(
  $$select public.edit_item('c0000000-0000-0000-0000-000000000021', 3, 'hello!', null, null, null, 'blush')$$,
  'author edits');
select is(
  (select body || '/' || color::text || '/' || version::text from public.items
   where id = 'c0000000-0000-0000-0000-000000000021'),
  'hello!/blush/4', 'edit persists with version bump');
select throws_ok(
  $$select public.edit_item('c0000000-0000-0000-0000-000000000021', 1, 'stale', null, null, null, 'butter')$$,
  'P0001', 'version_conflict', 'stale version rejected');
select lives_ok(
  $$select public.set_done('c0000000-0000-0000-0000-000000000021', true)$$,
  'author marks done');
select ok(
  (select done_by = 'a0000000-0000-0000-0000-000000000021'
      and keep_until > now() and keep_until < now() + interval '3 days'
   from public.items where id = 'c0000000-0000-0000-0000-000000000021'),
  'done stamps actor with 2-day keep');
select lives_ok(
  $$select public.set_done('c0000000-0000-0000-0000-000000000021', false)$$,
  'author undoes done');
select ok(
  (select done_at is null and done_by is null and keep_until > now() + interval '6 days'
   from public.items where id = 'c0000000-0000-0000-0000-000000000021'),
  'undo restores the type default');
select lives_ok(
  $$select public.keep_longer('c0000000-0000-0000-0000-000000000021')$$,
  'keep longer');
select ok(
  (select keep_until > now() + interval '13 days'
   from public.items where id = 'c0000000-0000-0000-0000-000000000021'),
  'keep extended by 7 days');
select lives_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000028', (select id from t_b),
    'list', 'paper', null, 'Tasks', null, null, null, false, null)$$,
  'post list');
select throws_ok(
  $$select public.keep_longer('c0000000-0000-0000-0000-000000000028')$$,
  'P0001', 'invalid_input', 'lists cannot keep longer');
select lives_ok(
  $$select public.set_pinned('c0000000-0000-0000-0000-000000000028', true)$$,
  'pin list');
select throws_ok(
  $$select public.keep_longer('c0000000-0000-0000-0000-000000000028')$$,
  'P0001', 'invalid_input', 'pinned items cannot keep longer');
select lives_ok(
  $$select public.remove_item('c0000000-0000-0000-0000-000000000028')$$,
  'remove list');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000023', true);
set role authenticated;
select throws_ok(
  $$select public.edit_item('c0000000-0000-0000-0000-000000000021', 5, 'sneak', null, null, null, 'butter')$$,
  'P0001', 'not_member', 'stranger cannot edit');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000022', true);
set role authenticated;
select lives_ok(
  $$select public.remove_item('c0000000-0000-0000-0000-000000000021')$$,
  'non-author removes');
select is(
  (select count(*)::integer from public.visible_items where id = 'c0000000-0000-0000-0000-000000000021'),
  0, 'removed item hidden from the board view');
select is(
  (select count(*)::integer from public.list_removed_items((select id from t_b))),
  2, 'removed items listed for restore');
reset role;
-- Age one removal past the restore window (superuser setup).
update public.items
set deleted_at = now() - interval '31 days'
where id = 'c0000000-0000-0000-0000-000000000028';
update public.items
set keep_until = now() - interval '1 day'
where id = 'c0000000-0000-0000-0000-000000000021';
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000021', true);
set role authenticated;
select throws_ok(
  $$select public.restore_item('c0000000-0000-0000-0000-000000000028')$$,
  'P0001', 'invalid_input', 'restore after 30 days rejected');
select throws_ok(
  $$select public.edit_item('c0000000-0000-0000-0000-000000000021', 8, 'sneak', null, null, null, 'butter')$$,
  'P0001', 'not_found', 'removed items cannot be edited');
select lives_ok(
  $$select public.restore_item('c0000000-0000-0000-0000-000000000021')$$,
  'restore within window');
select ok(
  (select deleted_at is null and keep_until > now() and keep_until < now() + interval '3 days'
   from public.items where id = 'c0000000-0000-0000-0000-000000000021'),
  'restore refreshes a lapsed keep_until');
select is(
  (select count(*)::integer from public.visible_items where id = 'c0000000-0000-0000-0000-000000000021'),
  1, 'restored item visible again');
select lives_ok(
  $$select public.edit_item('c0000000-0000-0000-0000-000000000024', 1, null, 'Party!', '2026-10-05T10:00:00Z', 'Beach', 'sky')$$,
  'edit date');
select is(
  (select keep_until from public.items where id = 'c0000000-0000-0000-0000-000000000024'),
  '2026-10-06T00:00:00+00'::timestamptz, 'date edit recomputes keep_until');
reset role;

select * from finish();
rollback;
