-- Phase 1d: invite links — issue/reuse/rotate/revoke, preview, accept, limits.
-- Roles: O owner, M member, S joiner, T probe, U probe.
begin;
select plan(53);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-000000000041', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000042', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000043', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000044', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000045', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000046', 'authenticated', 'authenticated');
delete from vault.secrets where name = 'invite';
select vault.create_secret('test-invite-key-0123456789abcdef', 'invite');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000041', true);
set role authenticated;
select lives_ok($$select public.create_board('Invites', 'sage')$$, 'board created');
select lives_ok($$select public.update_profile('Anya', null)$$, 'owner named');
create temp table t_b as
  select id from public.boards where name = 'Invites' limit 1;
reset role;
grant select on t_b to authenticated;

-- Issue as owner: format and reuse.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000041', true);
set role authenticated;
create temp table t_link as
  select token, code from public.get_invite_link((select id from t_b));
reset role;
grant select on t_link to authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000041', true);
set role authenticated;
select ok(
  (select token ~ '^[A-Za-z0-9_-]{22}$' and code ~ '^[A-Z2-9]{5}-[A-Z2-9]{5}$'
   from t_link),
  'link format: 22-char base64url token, dashed code');
reset role;

-- The invite landing screen previews before any session: anon may use the
-- link token, but never the guessable short code.
grant select on t_link to anon;
set role anon;
select is(
  (select board_name from public.preview_invite_token((select token from t_link))),
  'Invites', 'anon previews the board by link token');
select is(
  (select member_count from public.preview_invite_token((select code from t_link))),
  null, 'anon token preview rejects the short code');
select throws_ok(
  $$select public.preview_invite((select token from t_link))$$,
  '42501', null, 'anon cannot use the authenticated preview');
reset role;

-- M joins via fixture and gets the identical link.
insert into public.board_members (board_id, user_id, role)
select id, 'a0000000-0000-0000-0000-000000000042', 'member' from t_b;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000042', true);
set role authenticated;
select ok(
  (select a.token = b.token and a.code = b.code
   from public.get_invite_link((select id from t_b)) a, t_link b),
  'member re-shares the same link');
reset role;

-- Strangers cannot mint links.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000043', true);
set role authenticated;
select throws_ok(
  $$select public.get_invite_link((select id from t_b))$$,
  'P0001', 'not_member', 'stranger cannot mint a link');
reset role;

-- Preview: content-free, silent on every failure.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000043', true);
set role authenticated;
select is(
  (select board_name from public.preview_invite((select code from t_link))),
  'Invites', 'preview names the board');
select is(
  (select invited_by from public.preview_invite((select code from t_link))),
  'Anya', 'preview names the inviter');
select ok(
  (select member_count >= 2 and array_length(member_first_names, 1) >= 2
   from public.preview_invite((select token from t_link))),
  'preview counts members without content');
select is(
  (select count(*)::integer from public.preview_invite('ZZZZZ-ZZZZZ')),
  0, 'wrong code previews empty');
select is(
  (select count(*)::integer from public.preview_invite('')),
  0, 'empty token previews empty');
reset role;

-- Accept by code: joins, trims the display name, idempotent on rejoin.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000043', true);
set role authenticated;
select is(
  (select public.accept_invite((select code from t_link), ' Sam  ')),
  (select id from t_b), 'accept by code returns the board');
select is(
  (select display_name from public.profiles where id = 'a0000000-0000-0000-0000-000000000043'),
  'Sam', 'display name set and trimmed');
select is(
  (select role::text from public.board_members
   where board_id = (select id from t_b) and user_id = 'a0000000-0000-0000-0000-000000000043'),
  'member', 'joiner is a plain member');
select lives_ok(
  $$select public.accept_invite((select token from t_link))$$,
  'rejoin is free');
select is(
  (select count(*)::integer from public.board_members
   where board_id = (select id from t_b) and user_id = 'a0000000-0000-0000-0000-000000000043'),
  1, 'no duplicate membership');
select is(
  (select public.accept_invite('NOPE0-00000')),
  null, 'wrong code accepts null');
reset role;

-- Expired links fail everywhere, then rotate on next issue.
-- T probes expiry; S is spent above, so it keeps its own try budget.
update public.invites set expires_at = now() - interval '1 day';
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000045', true);
set role authenticated;
select is(
  (select count(*)::integer from public.preview_invite((select code from t_link))),
  0, 'expired link previews empty');
select is(
  (select public.accept_invite((select token from t_link))),
  null, 'expired link accepts null');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000041', true);
set role authenticated;
create temp table t_link2 as
  select token, code from public.get_invite_link((select id from t_b));
reset role;
grant select on t_link2 to authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000041', true);
set role authenticated;
select ok(
  (select token <> (select token from t_link) from t_link2),
  'expired link rotates on next issue');
reset role;
select is(
  (select count(*)::integer from public.invites
   where board_id = (select id from t_b) and revoked_at is null),
  1, 'still exactly one active invite');

-- Revocation: owner only; member is refused.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000042', true);
set role authenticated;
select throws_ok(
  $$select public.reset_invite_link((select id from t_b))$$,
  'P0001', 'not_owner', 'member cannot revoke');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000041', true);
set role authenticated;
select lives_ok(
  $$select public.reset_invite_link((select id from t_b))$$,
  'owner revokes');
select is(
  (select count(*)::integer from public.preview_invite((select code from t_link2))),
  0, 'revoked link previews empty');
select is(
  (select public.accept_invite((select token from t_link2))),
  null, 'revoked link accepts null');
reset role;

-- Accepting onto a deleted board fails closed.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000041', true);
set role authenticated;
select lives_ok($$select public.create_board('Gone', 'sage')$$, 'doomed board created');
create temp table t_gone_link as
  select token from public.get_invite_link((select id from public.boards where name = 'Gone'));
reset role;
grant select on t_gone_link to authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000041', true);
set role authenticated;
select lives_ok(
  $$select public.delete_board((select id from public.boards where name = 'Gone'))$$,
  'doomed board deleted');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000045', true);
set role authenticated;
select is(
  (select public.accept_invite((select token from t_gone_link))),
  null, 'accept onto deleted board is null');
select is(
  (select count(*)::integer from public.preview_invite((select token from t_gone_link))),
  0, 'preview of deleted board is empty');
reset role;

-- invite_try rate limit: a fresh user burns 10 wrong tries, the 11th is limited.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000044', true);
set role authenticated;
select ok((select public.accept_invite('Q1') is null), 'wrong try 1');
select ok((select public.accept_invite('Q2') is null), 'wrong try 2');
select ok((select public.accept_invite('Q3') is null), 'wrong try 3');
select ok((select public.accept_invite('Q4') is null), 'wrong try 4');
select ok((select public.accept_invite('Q5') is null), 'wrong try 5');
select ok((select public.accept_invite('Q6') is null), 'wrong try 6');
select ok((select public.accept_invite('Q7') is null), 'wrong try 7');
select ok((select public.accept_invite('Q8') is null), 'wrong try 8');
select ok((select public.accept_invite('Q9') is null), 'wrong try 9');
select ok((select public.accept_invite('Q10') is null), 'wrong try 10');
select throws_ok($$select public.accept_invite('Q11')$$, 'P0001', 'rate_limited', '11th wrong try is rate-limited');
reset role;

-- invite_try also throttles scripted guessing through preview.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000046', true);
set role authenticated;
select is((select count(*)::integer from public.preview_invite('P1')), 0, 'preview guess 1');
select is((select count(*)::integer from public.preview_invite('P2')), 0, 'preview guess 2');
select is((select count(*)::integer from public.preview_invite('P3')), 0, 'preview guess 3');
select is((select count(*)::integer from public.preview_invite('P4')), 0, 'preview guess 4');
select is((select count(*)::integer from public.preview_invite('P5')), 0, 'preview guess 5');
select is((select count(*)::integer from public.preview_invite('P6')), 0, 'preview guess 6');
select is((select count(*)::integer from public.preview_invite('P7')), 0, 'preview guess 7');
select is((select count(*)::integer from public.preview_invite('P8')), 0, 'preview guess 8');
select is((select count(*)::integer from public.preview_invite('P9')), 0, 'preview guess 9');
select is((select count(*)::integer from public.preview_invite('P10')), 0, 'preview guess 10');
select throws_ok($$select public.preview_invite('P11')$$, 'P0001', 'rate_limited', '11th preview guess is rate-limited');
reset role;

select * from finish();
rollback;
