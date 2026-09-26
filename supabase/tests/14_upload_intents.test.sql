-- Upload intents: issue, bind, consume, quotas (release hardening).
-- O owns a board; M is a co-member; S is a stranger.
-- Only the upload-photo Edge Function (service role) writes bytes; the
-- storage policy admits no client uploads. Quotas: 20 intents/hour/account,
-- 20 pending per user, 500 live photos per board, 1 GB per account.
begin;
select plan(20);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-000000000081', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000082', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000083', 'authenticated', 'authenticated');
insert into public.boards (id, name, created_by)
values ('b0000000-0000-0000-0000-000000000081', 'Intents', 'a0000000-0000-0000-0000-000000000081');
insert into public.board_members (board_id, user_id, role) values
  ('b0000000-0000-0000-0000-000000000081', 'a0000000-0000-0000-0000-000000000081', 'owner'),
  ('b0000000-0000-0000-0000-000000000081', 'a0000000-0000-0000-0000-000000000082', 'member');

-- O issues an intent for their item.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000081', true);
set role authenticated;
select ok(
  public.start_photo_upload('b0000000-0000-0000-0000-000000000081',
    'c0000000-0000-0000-0000-000000000081')
    like 'b0000000-0000-0000-0000-000000000081/c0000000-0000-0000-0000-000000000081/%.jpg',
  'intent path is bound to board/item and ends in .jpg');
create temp table t_intent as
  select path from public.photo_upload_intents
  where user_id = 'a0000000-0000-0000-0000-000000000081' limit 1;
grant select on t_intent to authenticated;

-- A forged path (no intent) is rejected by post_item.
select throws_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000081', 'b0000000-0000-0000-0000-000000000081',
    'photo', 'paper', 'cap', null, null, null,
    'b0000000-0000-0000-0000-000000000081/c0000000-0000-0000-0000-000000000081/forged.jpg',
    false, null)$$,
  'P0001', 'invalid_input', 'photo without an intent rejected');

-- The intent path links exactly once.
select lives_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000081', 'b0000000-0000-0000-0000-000000000081',
    'photo', 'paper', 'cap', null, null, null, (select path from t_intent), false, null)$$,
  'photo with an intent path posts');
select is(
  (select consumed from public.photo_upload_intents where path = (select path from t_intent)),
  true, 'linking the photo consumes the intent');

-- Idempotent retry of the same item id passes (client reuse path).
select lives_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000081', 'b0000000-0000-0000-0000-000000000081',
    'photo', 'paper', 'cap', null, null, null, (select path from t_intent), false, null)$$,
  'reposting the same item id with a consumed intent succeeds');

-- Replaying the consumed path onto another item is rejected.
select throws_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000082', 'b0000000-0000-0000-0000-000000000081',
    'photo', 'paper', 'cap', null, null, null, (select path from t_intent), false, null)$$,
  'P0001', 'invalid_input', 'consumed path cannot be replayed onto another item');

-- An intent is bound to the issuing user: M cannot link O's intent.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000082', true);
select throws_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000083', 'b0000000-0000-0000-0000-000000000081',
    'photo', 'paper', 'cap', null, null, null, (select path from t_intent), false, null)$$,
  'P0001', 'invalid_input', 'another member cannot link my intent');

-- S cannot issue an intent on a foreign board.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000083', true);
select throws_ok(
  $$select public.start_photo_upload('b0000000-0000-0000-0000-000000000081',
    'c0000000-0000-0000-0000-000000000084')$$,
  'P0001', 'not_member', 'stranger cannot start an upload');
reset role;

-- Anon cannot issue intents.
set role anon;
select throws_ok(
  $$select public.start_photo_upload('b0000000-0000-0000-0000-000000000081',
    'c0000000-0000-0000-0000-000000000085')$$,
  '42501', null, 'anon cannot start an upload');
reset role;

-- Expired unused intents never link. The sweep only clears unreferenced rows
-- past the orphan horizon (25h): accounting must outlive the bytes.
insert into public.photo_upload_intents (path, board_id, item_id, user_id, expires_at) values
  ('b0000000-0000-0000-0000-000000000081/c0000000-0000-0000-0000-000000000086/stale.jpg',
   'b0000000-0000-0000-0000-000000000081', 'c0000000-0000-0000-0000-000000000086',
   'a0000000-0000-0000-0000-000000000081', now() - interval '26 hours');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000081', true);
set role authenticated;
select throws_ok(
  $$select public.post_item('c0000000-0000-0000-0000-000000000086', 'b0000000-0000-0000-0000-000000000081',
    'photo', 'paper', 'cap', null, null, null,
    'b0000000-0000-0000-0000-000000000081/c0000000-0000-0000-0000-000000000086/stale.jpg',
    false, null)$$,
  'P0001', 'invalid_input', 'expired intent cannot link a photo');
reset role;
-- A recently-expired unreferenced row survives: its bytes may still exist
-- (orphan sweeper horizon is 24h), so the quota must keep counting it.
insert into public.photo_upload_intents (path, board_id, item_id, user_id, expires_at) values
  ('b0000000-0000-0000-0000-000000000081/c0000000-0000-0000-0000-000000000087/fresh.jpg',
   'b0000000-0000-0000-0000-000000000081', 'c0000000-0000-0000-0000-000000000087',
   'a0000000-0000-0000-0000-000000000081', now() - interval '2 hours');
select is(public.purge_stale_upload_intents(), 1, 'sweep removes only the oldest expired intent');
select is(
  (select count(*)::integer from public.photo_upload_intents
   where path = 'b0000000-0000-0000-0000-000000000081/c0000000-0000-0000-0000-000000000087/fresh.jpg'),
  1, 'recently-expired accounting survives the sweep');
select is(
  (select count(*)::integer from public.photo_upload_intents
   where path = (select path from t_intent)),
  1, 'the consumed live intent survives the sweep');
select is(
  (select count(*)::integer from cron.job where jobname = 'cleanup-upload-intents'),
  1, 'cleanup-upload-intents is scheduled');

-- start_photo_upload is callable by authenticated but private helpers are not.
select ok(has_function_privilege('authenticated',
  'public.start_photo_upload(uuid, uuid)', 'execute'), 'start_photo_upload is client-callable');
select ok(not has_function_privilege('authenticated',
  'public._consume_photo_intent(uuid, uuid, text)', 'execute'), '_consume_photo_intent is closed');
select ok(not has_function_privilege('authenticated',
  'public.purge_stale_upload_intents()', 'execute'), 'purge_stale_upload_intents is closed');

-- Per-account storage cap: M with 1 GB already stored cannot start another.
insert into public.photo_upload_intents (path, board_id, item_id, user_id, byte_size) values
  ('b0000000-0000-0000-0000-000000000081/c0000000-0000-0000-0000-000000000090/full.jpg',
   'b0000000-0000-0000-0000-000000000081', 'c0000000-0000-0000-0000-000000000090',
   'a0000000-0000-0000-0000-000000000082', 1073741824);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000082', true);
set role authenticated;
select throws_ok(
  $$select public.start_photo_upload('b0000000-0000-0000-0000-000000000081',
    'c0000000-0000-0000-0000-000000000091')$$,
  'P0001', 'rate_limited', 'account at 1 GB storage cap refused');
reset role;

-- The 21st intent in the hour is refused (20/hour/account cap). O already
-- issued 1 above; 19 more succeed, the next fails.
-- NOTE: pgTAP runs in one transaction; hit_rate_limit windows keyed by hour.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000081', true);
set role authenticated;
select lives_ok(
  $$select count(public.start_photo_upload('b0000000-0000-0000-0000-000000000081',
    ('c0000100-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid))
    from generate_series(1, 19) g$$,
  'intents 2..20 in the hour succeed');
select throws_ok(
  $$select public.start_photo_upload('b0000000-0000-0000-0000-000000000081',
    'c0000000-0000-0000-0000-000000000099')$$,
  'P0001', 'rate_limited', '21st intent in the hour refused');
reset role;

select * from finish();
rollback;
