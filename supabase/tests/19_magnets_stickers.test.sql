-- Magnets, stickers and packs (docs/prd-magents-stickers.md §6, §9).
-- Roles: O owner, M member, S stranger.
begin;
select plan(26);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-000000000091', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000092', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000093', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000094', 'authenticated', 'authenticated');
insert into public.boards (id, name, created_by)
values ('b0000000-0000-0000-0000-000000000091', 'Fridge', 'a0000000-0000-0000-0000-000000000091');
insert into public.board_members (board_id, user_id, role) values
  ('b0000000-0000-0000-0000-000000000091', 'a0000000-0000-0000-0000-000000000091', 'owner'),
  ('b0000000-0000-0000-0000-000000000091', 'a0000000-0000-0000-0000-000000000092', 'member'),
  ('b0000000-0000-0000-0000-000000000091', 'a0000000-0000-0000-0000-000000000093', 'member');
insert into public.items (id, board_id, type, body, created_by)
values ('c0000000-0000-0000-0000-000000000091', 'b0000000-0000-0000-0000-000000000091',
        'note', 'groceries', 'a0000000-0000-0000-0000-000000000091');

-- A paid pack + entitlement for M, to exercise board_can_use.
insert into public.pack_catalog (id, kind, name, status)
values ('kitchen', 'theme', 'Kitchen', 'live');
insert into public.pack_art (art_id, pack_id, kind, label, path)
values ('kt_kettle', 'kitchen', 'magnet', 'Kettle', 'packs/kitchen/v1/kt_kettle@3x.webp'),
       ('kt_egg', 'kitchen', 'sticker', 'Egg', 'packs/kitchen/v1/kt_egg@3x.webp');

-- Starter is free and usable with no entitlement.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000092', true);
set role authenticated;
select is(public.board_can_use('b0000000-0000-0000-0000-000000000091', 'starter'),
  true, 'starter is free for any member');
select is(public.board_can_use('b0000000-0000-0000-0000-000000000091', 'kitchen'),
  false, 'paid pack unusable without an entitlement');
select throws_ok(
  $$select public.place_magnet('b0000000-0000-0000-0000-000000000091', 'kt_kettle', 0.5, 50, null, 0, null)$$,
  'P0001', 'not_entitled', 'cannot place art from an unowned pack');

-- M places a free starter magnet; z starts at 1.
select lives_ok(
  $$select public.place_magnet('b0000000-0000-0000-0000-000000000091', 'st_fuji', 0.4, 120, null, 0.08, null)$$,
  'member places a starter magnet');
reset role;
select is(
  (select z from public.board_magnets where board_id = 'b0000000-0000-0000-0000-000000000091'
   order by z desc limit 1),
  1::bigint, 'first magnet has z=1');
-- Attach-on-drop stores the note link (M-4).
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000092', true);
set role authenticated;
select lives_ok(
  $$select public.place_magnet('b0000000-0000-0000-0000-000000000091', 'st_boba', 0.5, 30,
      'c0000000-0000-0000-0000-000000000091', 0, null)$$,
  'magnet attaches to a note on drop');
reset role;
select is(
  (select item_id from public.board_magnets
   where board_id = 'b0000000-0000-0000-0000-000000000091' order by z desc limit 1),
  'c0000000-0000-0000-0000-000000000091'::uuid, 'magnet stores the attached note');
-- The most recently placed magnet is on top.
select is(
  (select z from public.board_magnets where board_id = 'b0000000-0000-0000-0000-000000000091'
   order by z desc limit 1),
  2::bigint, 'new magnet is stacked on top');

-- Stickers are flat decorations placed through the same RPC (no reactions).
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000092', true);
set role authenticated;
select lives_ok(
  $$select public.place_magnet('b0000000-0000-0000-0000-000000000091', 'st_love', 0.2, 60, null, 0, null)$$,
  'member places a sticker decoration');
reset role;

-- Any member can move any magnet (shared fridge).
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000091', true);
set role authenticated;
select lives_ok(
  $$select public.move_magnet(
      (select id from public.board_magnets where board_id = 'b0000000-0000-0000-0000-000000000091' and z = 1),
      0.9, 400, null, 1)$$,
  'owner moves a member''s magnet');
-- A stale version is rejected (the just-moved magnet is on top, version 2).
select throws_ok(
  $$select public.move_magnet(
      (select id from public.board_magnets where board_id = 'b0000000-0000-0000-0000-000000000091'
       order by z desc limit 1),
      0.1, 10, null, 1)$$,
  'P0001', 'version_conflict', 'stale version rejected');

-- Only the placer or owner can remove (M-10).
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000093', true);
set role authenticated;
select throws_ok(
  $$select public.remove_magnet(
      (select id from public.board_magnets where board_id = 'b0000000-0000-0000-0000-000000000091' limit 1))$$,
  'P0001', 'not_allowed', 'another member cannot remove a magnet they did not place');
reset role;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000091', true);
set role authenticated;
select lives_ok(
  $$select public.remove_magnet(
      (select id from public.board_magnets where board_id = 'b0000000-0000-0000-0000-000000000091' limit 1))$$,
  'owner removes any magnet');

-- Entitlement added: the paid pack becomes usable board-wide (P-5).
reset role;
insert into public.user_entitlements (user_id, pack_id, source) values
  ('a0000000-0000-0000-0000-000000000092', 'kitchen', 'app_store');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000091', true);
set role authenticated;
select is(public.board_can_use('b0000000-0000-0000-0000-000000000091', 'kitchen'),
  true, 'co-member entitlement unlocks the pack for the board');
select lives_ok(
  $$select public.place_magnet('b0000000-0000-0000-0000-000000000091', 'kt_kettle', 0.2, 60, null, 0, null)$$,
  'owner can place art from a pack a co-member owns');

-- Revoked entitlement no longer unlocks the pack.
reset role;
update public.user_entitlements
set revoked_at = now()
where user_id = 'a0000000-0000-0000-0000-000000000092' and pack_id = 'kitchen';
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000092', true);
set role authenticated;
select is(public.board_can_use('b0000000-0000-0000-0000-000000000091', 'kitchen'),
  false, 'revoked entitlement no longer unlocks the pack');
select throws_ok(
  $$select public.place_magnet('b0000000-0000-0000-0000-000000000091', 'kt_kettle', 0.3, 70, null, 0, null)$$,
  'P0001', 'not_entitled', 'cannot place magnet from a revoked pack');

-- Theme: owner only (H-1).
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000092', true);
set role authenticated;
select throws_ok(
  $$select public.set_board_theme('b0000000-0000-0000-0000-000000000091', 'starter')$$,
  'P0001', 'not_owner', 'member cannot set the door theme');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000091', true);
set role authenticated;
select lives_ok(
  $$select public.set_board_theme('b0000000-0000-0000-0000-000000000091', 'starter')$$,
  'owner sets the door theme');
reset role;
select is(
  (select theme_pack from public.boards where id = 'b0000000-0000-0000-0000-000000000091'),
  'starter', 'theme persisted');

-- M-6: removing a note detaches its magnets to the door (nothing lost).
select lives_ok(
  $$select public.remove_item('c0000000-0000-0000-0000-000000000091')$$,
  'note removed');
select is(
  (select count(*)::integer from public.board_magnets
   where board_id = 'b0000000-0000-0000-0000-000000000091' and item_id is null),
  (select count(*)::integer from public.board_magnets
   where board_id = 'b0000000-0000-0000-0000-000000000091'),
  'all magnets detached to the door, none lost');

-- Catalogue visibility: live packs readable by any signed-in user, drafts not.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000094', true);
set role authenticated;
select is(
  (select count(*)::integer from public.pack_catalog where id = 'starter'),
  1, 'stranger can read the live catalogue');
select is(
  (select count(*)::integer from public.pack_art where pack_id = 'starter'),
  13, 'stranger can read live pack art');
reset role;
insert into public.pack_catalog (id, kind, name, status)
values ('draft_pack', 'theme', 'Draft', 'draft');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000094', true);
set role authenticated;
select is(
  (select count(*)::integer from public.pack_catalog where id = 'draft_pack'),
  0, 'draft pack hidden from clients');

-- RLS: a stranger sees no magnets.
select is(
  (select count(*)::integer from public.board_magnets
   where board_id = 'b0000000-0000-0000-0000-000000000091'),
  0, 'stranger sees no magnets');

select * from finish();
rollback;
