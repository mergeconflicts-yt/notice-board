-- Shared-post attribution: post_shared_item stamps shared_from_* and reuses
-- post_item validation. Roles: O owner, M member, S stranger.
begin;
select plan(10);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-0000000000a4', 'authenticated', 'authenticated');
insert into public.boards (id, name, created_by)
values ('b0000000-0000-0000-0000-0000000000a1', 'Fridge', 'a0000000-0000-0000-0000-0000000000a1');
insert into public.board_members (board_id, user_id, role) values
  ('b0000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-0000000000a1', 'owner'),
  ('b0000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-0000000000a2', 'member'),
  ('b0000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-0000000000a4', 'member');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000a2', true);
set role authenticated;
select lives_ok(
  $$select public.post_shared_item('c0000000-0000-0000-0000-0000000000a1',
      'b0000000-0000-0000-0000-0000000000a1', 'note', 'butter',
      'Mom’s appointment is Tuesday at 10.', null, null, null, null, false, null,
      'WhatsApp', 'Paul')$$,
  'member posts a shared note');
reset role;
select is(
  (select shared_from_app from public.items where id = 'c0000000-0000-0000-0000-0000000000a1'),
  'WhatsApp', 'source app stamped');
select is(
  (select shared_from_author from public.items where id = 'c0000000-0000-0000-0000-0000000000a1'),
  'Paul', 'source author stamped');

-- Blank attribution is stored as NULL, not empty text.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000a2', true);
set role authenticated;
select lives_ok(
  $$select public.post_shared_item('c0000000-0000-0000-0000-0000000000a2',
      'b0000000-0000-0000-0000-0000000000a1', 'note', 'butter',
      'plain note', null, null, null, null, false, null, '  ', null)$$,
  'blank attribution accepted');
reset role;
select is(
  (select shared_from_app from public.items where id = 'c0000000-0000-0000-0000-0000000000a2'),
  null, 'blank app stored as NULL');

-- Overlong attribution is rejected, and post_item rules still apply.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000a2', true);
set role authenticated;
select throws_ok(
  $$select public.post_shared_item('c0000000-0000-0000-0000-0000000000a3',
      'b0000000-0000-0000-0000-0000000000a1', 'note', 'butter',
      'x', null, null, null, null, false, null, rpad('a', 121, 'a'), null)$$,
  'P0001', 'invalid_input', 'overlong attribution rejected');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000a3', true);
set role authenticated;
select throws_ok(
  $$select public.post_shared_item('c0000000-0000-0000-0000-0000000000a4',
      'b0000000-0000-0000-0000-0000000000a1', 'note', 'butter',
      'sneak', null, null, null, null, false, null, 'WhatsApp', null)$$,
  'P0001', 'not_member', 'stranger cannot post a shared note');
reset role;

-- Attribution hijack: post_item returns the existing row when p_id is taken,
-- so a member reusing another member's id must fail instead of rewriting
-- their attribution (migration 22). Same-id retries by the author still pass
-- (covered above: the author owns every row created here).
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000a4', true);
set role authenticated;
select throws_ok(
  $$select public.post_shared_item('c0000000-0000-0000-0000-0000000000a1',
      'b0000000-0000-0000-0000-0000000000a1', 'note', 'butter',
      'hijacked body', null, null, null, null, false, null, 'EvilApp', 'Mallory')$$,
  'P0001', 'invalid_input', 'member cannot stamp attribution onto another member''s post');
reset role;
select is(
  (select shared_from_app from public.items where id = 'c0000000-0000-0000-0000-0000000000a1'),
  'WhatsApp', 'hijack left the original attribution untouched');
select is(
  (select body from public.items where id = 'c0000000-0000-0000-0000-0000000000a1'),
  'Mom’s appointment is Tuesday at 10.', 'hijack left the original body untouched');

select * from finish();
rollback;
