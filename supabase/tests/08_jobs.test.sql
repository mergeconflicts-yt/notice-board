-- Phase 6: maintenance jobs (expire + rate-limit cleanup) and their schedule.
begin;
select plan(18);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-000000000071', 'authenticated', 'authenticated');
insert into public.boards (id, name, created_by)
values ('b0000000-0000-0000-0000-000000000071', 'Jobs', 'a0000000-0000-0000-0000-000000000071');
insert into public.board_members (board_id, user_id, role)
values ('b0000000-0000-0000-0000-000000000071', 'a0000000-0000-0000-0000-000000000071', 'owner');
insert into public.items (id, board_id, type, body, keep_until, created_by) values
  ('c0000000-0000-0000-0000-000000000071', 'b0000000-0000-0000-0000-000000000071',
   'note', 'lapsed', now() - interval '1 minute', 'a0000000-0000-0000-0000-000000000071'),
  ('c0000000-0000-0000-0000-000000000072', 'b0000000-0000-0000-0000-000000000071',
   'note', 'kept', null, 'a0000000-0000-0000-0000-000000000071');

-- Expire job.
select ok(public.expire_items() >= 1, 'expire_items reports the lapse');
select is(
  (select deleted_at is not null from public.items where id = 'c0000000-0000-0000-0000-000000000071'),
  true, 'lapsed item soft-deleted');
select is(
  (select count(*)::integer from public.visible_items
   where id = 'c0000000-0000-0000-0000-000000000071'),
  0, 'lapsed item hidden from the board');
select is(
  (select deleted_at is null from public.items where id = 'c0000000-0000-0000-0000-000000000072'),
  true, 'kept-forever item untouched');

-- Rate-limit window cleanup: old windows go, current ones stay.
insert into public.rate_limits (user_id, action, window_start, count) values
  ('a0000000-0000-0000-0000-000000000071', 'x', now() - interval '3 hours', 5),
  ('a0000000-0000-0000-0000-000000000071', 'x', now() - interval '5 minutes', 2);
select is(public.cleanup_rate_limits(), 1, 'cleanup removes exactly the stale window');
select is(
  (select count(*)::integer from public.rate_limits
   where user_id = 'a0000000-0000-0000-0000-000000000071' and action = 'x'),
  1, 'current window survives');

-- Stale invites (revoked or expired over a week) are purged.
insert into public.invites (board_id, token_hash, code_hash, secret_enc, expires_at, revoked_at) values
  ('b0000000-0000-0000-0000-000000000071', extensions.gen_random_bytes(16), extensions.gen_random_bytes(16), extensions.gen_random_bytes(16), now() - interval '1 day', now() - interval '8 days'),
  ('b0000000-0000-0000-0000-000000000071', extensions.gen_random_bytes(16), extensions.gen_random_bytes(16), extensions.gen_random_bytes(16), now() + interval '1 day', null);
select is(public.purge_stale_invites(), 1, 'purge_stale_invites removes the stale row');
select is(
  (select count(*)::integer from public.invites
   where board_id = 'b0000000-0000-0000-0000-000000000071'),
  1, 'a live invite survives');

-- Purge candidates: only items removed beyond the 30-day retention window.
insert into public.items (id, board_id, type, body, created_by, deleted_at) values
  ('c0000000-0000-0000-0000-000000000073', 'b0000000-0000-0000-0000-000000000071',
   'note', 'old', 'a0000000-0000-0000-0000-000000000071', now() - interval '31 days'),
  ('c0000000-0000-0000-0000-000000000074', 'b0000000-0000-0000-0000-000000000071',
   'note', 'recent', 'a0000000-0000-0000-0000-000000000071', now() - interval '1 day');
select is(
  (select count(*)::integer from public.expired_for_purge()
   where id in ('c0000000-0000-0000-0000-000000000073', 'c0000000-0000-0000-0000-000000000074')),
  1, 'only the item older than 30 days is a purge candidate');
select ok(
  (select deleted_at < now() - interval '30 days'
   from public.expired_for_purge() where id = 'c0000000-0000-0000-0000-000000000073'),
  'the old item is included');

-- Items on a board deleted over 30 days ago are candidates too.
insert into public.boards (id, name, created_by, deleted_at)
values ('b0000000-0000-0000-0000-000000000072', 'Gone', 'a0000000-0000-0000-0000-000000000071',
        now() - interval '31 days');
insert into public.items (id, board_id, type, body, created_by, deleted_at)
values ('c0000000-0000-0000-0000-000000000075', 'b0000000-0000-0000-0000-000000000072',
        'note', 'on a dead board', 'a0000000-0000-0000-0000-000000000071', now());
select is(
  (select count(*)::integer from public.expired_for_purge()
   where id = 'c0000000-0000-0000-0000-000000000075'),
  1, 'items on a long-deleted board are purge candidates');

-- Purge RPCs.
insert into public.items (id, board_id, type, body, photo_path, created_by)
values ('c0000000-0000-0000-0000-000000000076', 'b0000000-0000-0000-0000-000000000071',
        'photo', 'p', 'b0000000-0000-0000-0000-000000000071/c0000000-0000-0000-0000-000000000076/x.jpg',
        'a0000000-0000-0000-0000-000000000071');
select ok(
  'b0000000-0000-0000-0000-000000000071/c0000000-0000-0000-0000-000000000076/x.jpg'
    = any(public.photo_paths_in_use()),
  'photo_paths_in_use lists an in-use path');
select is(
  public.purge_items(array['c0000000-0000-0000-0000-000000000076']::uuid[]),
  1, 'purge_items deletes the batch');
select is(
  (select count(*)::integer from public.items where id = 'c0000000-0000-0000-0000-000000000076'),
  0, 'purged item is gone');

-- purge_boards: only boards with no items left.
insert into public.boards (id, name, created_by, deleted_at) values
  ('b0000000-0000-0000-0000-000000000073', 'NoItems', 'a0000000-0000-0000-0000-000000000071', now() - interval '31 days'),
  ('b0000000-0000-0000-0000-000000000074', 'HasItems', 'a0000000-0000-0000-0000-000000000071', now() - interval '31 days');
insert into public.items (id, board_id, type, body, created_by)
values ('c0000000-0000-0000-0000-000000000077', 'b0000000-0000-0000-0000-000000000074',
        'note', 'x', 'a0000000-0000-0000-0000-000000000071');
select is(public.purge_boards(), 1, 'purge_boards deletes the itemless deleted board');
select ok(
  (select count(*)::integer from public.boards
   where id in ('b0000000-0000-0000-0000-000000000073', 'b0000000-0000-0000-0000-000000000074')) = 1,
  'a deleted board that still has items is kept');

-- Schedule present.
select is(
  (select count(*)::integer from cron.job where jobname = 'expire-items'),
  1, 'expire-items is scheduled');
select is(
  (select count(*)::integer from cron.job where jobname = 'cleanup-invites'),
  1, 'cleanup-invites is scheduled');

select * from finish();
rollback;
