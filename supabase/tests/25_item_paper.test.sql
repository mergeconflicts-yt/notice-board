-- Paper style on create (migration 20261123000026_item_paper).
-- Roles: O board owner, M member, S stranger.
begin;
select plan(5);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-0000000000e2', 'authenticated', 'authenticated');
insert into public.boards (id, name, created_by)
values ('b0000000-0000-0000-0000-0000000000e1', 'Paper fridge', 'a0000000-0000-0000-0000-0000000000e1');
insert into public.board_members (board_id, user_id, role) values
  ('b0000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-0000000000e1', 'owner');

insert into public.pack_catalog (id, kind, name, status, spec) values
  ('paper_pack', 'theme', 'Paper pack', 'live',
   '{"papers":[{"id":"gingham","name":"Gingham","bg":"#FBEFF2","ink":"#6E4550","texture":"gingham"}]}'::jsonb),
  ('other_pack', 'theme', 'Other pack', 'live',
   '{"papers":[{"id":"plainish","name":"Plainish","bg":"#FFFDF7","ink":"#3E362E"}]}'::jsonb);

insert into public.user_entitlements (user_id, pack_id, source) values
  ('a0000000-0000-0000-0000-0000000000e1', 'paper_pack', 'promo');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000e1', true);
set role authenticated;

select lives_ok(
  $$select public.post_item_with_paper(
      'c0000000-0000-0000-0000-0000000000e1', 'b0000000-0000-0000-0000-0000000000e1',
      'note', 'butter', 'paper note', null, null, null, null, false, null,
      'paper_pack:gingham')$$,
  'owner posts a note with a paper from an owned pack');
reset role;

select is(
  (select paper_style from public.items where id = 'c0000000-0000-0000-0000-0000000000e1'),
  'paper_pack:gingham', 'the chosen paper key is stored');
select is(
  (select version from public.items where id = 'c0000000-0000-0000-0000-0000000000e1'),
  2, 'adding the paper bumps the item version');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000e1', true);
set role authenticated;

select throws_ok(
  $$select public.post_item_with_paper(
      'c0000000-0000-0000-0000-0000000000e2', 'b0000000-0000-0000-0000-0000000000e1',
      'note', 'butter', 'bad paper', null, null, null, null, false, null,
      'paper_pack:nope')$$,
  'P0001', 'unknown_paper', 'an unknown paper id is rejected');

select throws_ok(
  $$select public.post_item_with_paper(
      'c0000000-0000-0000-0000-0000000000e3', 'b0000000-0000-0000-0000-0000000000e1',
      'note', 'butter', 'other paper', null, null, null, null, false, null,
      'other_pack:plainish')$$,
  'P0001', 'not_entitled', 'a paper from an unowned pack is rejected');

select * from finish();
rollback;
