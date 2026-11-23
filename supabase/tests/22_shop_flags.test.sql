-- Shop page flags (migration 20261123000023_shop_flags).
-- Covers category/pack visibility, renderer gating, regions, sale state,
-- item counts, featured bundles and the tester allow-list.
begin;
select plan(26);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated');

insert into public.shop_testers (user_id)
values ('a0000000-0000-0000-0000-0000000000c2');

insert into public.shop_categories (id, title, chip_label, card_tag, layout, sort, status) values
  ('livecat', 'Live things', 'Live', 'Thing', 'grid', 10, 'live'),
  ('draftcat', 'Draft things', 'Draft', 'Draft', 'grid', 20, 'draft'),
  ('futurecat', 'Future things', 'Future', 'Future', 'grid', 30, 'live'),
  ('regioncat', 'Japan things', 'Japan', 'Japan', 'row', 40, 'live');
update public.shop_categories set available_from = now() + interval '1 day' where id = 'futurecat';
update public.shop_categories set regions = array['JP'] where id = 'regioncat';

insert into public.pack_catalog
  (id, kind, name, status, sort, category_id, store_product_id, price_label,
   available_until, card_tag, card_bg, badge_text, sale_store_product_id,
   sale_from, sale_until, sale_label)
values
  ('p_live', 'theme', 'Live pack', 'live', 10, 'livecat', 'prod_live', '$1.99',
   now() + interval '30 days', 'Sport', '#DDEFD9', 'New', 'prod_live_sale',
   now() - interval '1 day', now() + interval '1 day', '25% off'),
  ('p_draft', 'theme', 'Draft pack', 'draft', 20, 'livecat', 'prod_draft', '$1.99',
   null, null, null, null, null, null, null, null),
  ('p_future', 'theme', 'Future pack', 'live', 30, 'livecat', 'prod_future', '$1.99',
   null, null, null, null, null, null, null, null),
  ('p_past', 'festival', 'Past pack', 'live', 40, 'livecat', 'prod_past', '$0.99',
   now() - interval '1 day', null, null, null, null, null, null, null),
  ('p_region', 'travel', 'Japan pack', 'live', 50, 'regioncat', 'prod_jp', '$0.99',
   null, null, null, null, null, null, null, null),
  ('p_new', 'theme', 'New renderer pack', 'live', 60, 'livecat', 'prod_new', '$1.99',
   null, null, null, null, null, null, null, null),
  ('p_bundle', 'bundle', 'Everything', 'live', 70, null, 'prod_bundle', '$9.99',
   null, null, null, null, null, null, null, null),
  ('p_bundle_off', 'bundle', 'Hidden bundle', 'live', 80, null, 'prod_bundle_off', '$4.99',
   null, null, null, null, null, null, null, null),
  ('p_other', 'theme', 'Draft category pack', 'live', 90, 'draftcat', 'prod_other', '$1.99',
   null, null, null, null, null, null, null, null);

update public.pack_catalog set available_from = now() + interval '1 day' where id = 'p_future';
update public.pack_catalog set min_renderer = 9 where id = 'p_new';
update public.pack_catalog set featured = true, bundle_of = array['p_live', 'p_past']
where id = 'p_bundle';
update public.pack_catalog set featured = false, bundle_of = array['p_live']
where id = 'p_bundle_off';

insert into public.pack_art (art_id, pack_id, kind, label, path, status, sort) values
  ('a_live_m1', 'p_live', 'magnet', 'Jersey', 'packs/p_live/v1/jersey@3x.webp', 'live', 10),
  ('a_live_s1', 'p_live', 'sticker', 'Goal', 'packs/p_live/v1/goal@3x.webp', 'live', 20),
  ('a_live_p1', 'p_live', 'paper', 'Notebook', 'packs/p_live/v1/notebook@3x.webp', 'live', 30),
  ('a_live_d1', 'p_live', 'door', 'Door', 'packs/p_live/v1/door@3x.webp', 'live', 40),
  ('a_live_f1', 'p_live', 'fastener', 'Clip', 'packs/p_live/v1/clip@3x.webp', 'live', 50),
  ('a_live_m2', 'p_live', 'magnet', 'Ball', 'packs/p_live/v1/ball@3x.webp', 'retired', 5);

-- Normal member: live non-region catalogue.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000c1', true);
set role authenticated;
select is(
  (select count(*)::integer from jsonb_array_elements(public.get_shop(1, 'US')->'categories') c
   where c->>'id' = 'livecat'),
  1, 'live category with a visible pack is returned');
select is(
  (select count(*)::integer from jsonb_array_elements(public.get_shop(1, 'US')->'categories') c
   where c->>'id' = 'draftcat'),
  0, 'draft category is hidden from normal accounts');
select is(
  (select count(*)::integer from jsonb_array_elements(public.get_shop(1, 'US')->'categories') c
   where c->>'id' = 'futurecat'),
  0, 'future category is hidden');
select is(
  (select count(*)::integer from jsonb_array_elements(public.get_shop(1, 'US')->'categories') c
   where c->>'id' = 'regioncat'),
  0, 'region category is hidden outside its region');
select is(
  (select count(*)::integer from jsonb_array_elements(public.get_shop(1, 'US')->'packs') p
   where p->>'id' = 'p_live'),
  1, 'live pack is returned');
select is(
  (select count(*)::integer from jsonb_array_elements(public.get_shop(1, 'US')->'packs') p
   where p->>'id' = 'p_draft'),
  0, 'draft pack is hidden from normal accounts');
select is(
  (select count(*)::integer from jsonb_array_elements(public.get_shop(1, 'US')->'packs') p
   where p->>'id' = 'p_future'),
  0, 'pack not yet available is hidden');
select is(
  (select count(*)::integer from jsonb_array_elements(public.get_shop(1, 'US')->'packs') p
   where p->>'id' = 'p_past'),
  0, 'pack past available_until is hidden');
select is(
  (select count(*)::integer from jsonb_array_elements(public.get_shop(1, 'US')->'packs') p
   where p->>'id' = 'p_new'),
  0, 'pack needing a newer renderer is hidden');
select is(
  (select count(*)::integer from jsonb_array_elements(public.get_shop(1, 'US')->'packs') p
   where p->>'id' = 'p_bundle_off'),
  0, 'ordinary bundles are hidden');
select is(
  (select count(*)::integer from jsonb_array_elements(public.get_shop(1, 'US')->'packs') p
   where p->>'id' = 'p_bundle'),
  1, 'featured bundle is returned for the collection offer');
select is(
  (select count(*)::integer from jsonb_array_elements(public.get_shop(1, 'US')->'packs') p
   where p->>'id' = 'p_other'),
  0, 'pack in a hidden category is hidden');
-- Renderer 2: the seeded Cute pack (min_renderer 2) is owned by every local
-- test profile, so only p_new (min_renderer 9) counts as gated.
select is(
  public.get_shop(2, 'US')->>'hiddenForUpdate',
  '1', 'renderer-gated packs are counted for the update line');
select is(
  (select (p->>'itemCount')::integer from jsonb_array_elements(public.get_shop(1, 'US')->'packs') p
   where p->>'id' = 'p_live'),
  3, 'item count includes live magnets, stickers and papers only');
select is(
  (select p->>'cardTag' from jsonb_array_elements(public.get_shop(1, 'US')->'packs') p
   where p->>'id' = 'p_live'),
  'Sport', 'pack card tag overrides the category tag');
select is(
  (select p->>'saleStoreProductId' from jsonb_array_elements(public.get_shop(1, 'US')->'packs') p
   where p->>'id' = 'p_live'),
  'prod_live_sale', 'an active sale exposes the sale product');
select is(
  (select jsonb_array_length(p->'bundleItems') from jsonb_array_elements(public.get_shop(1, 'US')->'packs') p
   where p->>'id' = 'p_bundle'),
  2, 'featured bundle lists every included pack');
select is(
  (select jsonb_array_length(p->'cardArt') from jsonb_array_elements(public.get_shop(1, 'US')->'packs') p
   where p->>'id' = 'p_live'),
  1, 'card art falls back to live magnets (retired magnet excluded)');
reset role;

-- Test account sees drafts, and the region caller sees the Japan pack.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000c2', true);
set role authenticated;
select is(
  (select count(*)::integer from jsonb_array_elements(public.get_shop(1, 'US')->'packs') p
   where p->>'id' = 'p_draft'),
  1, 'tester sees draft packs');
select is(
  (select count(*)::integer from jsonb_array_elements(public.get_shop(1, 'US')->'categories') c
   where c->>'id' = 'draftcat'),
  1, 'tester sees draft categories');
select is(
  (select count(*)::integer from jsonb_array_elements(public.get_shop(1, 'JP')->'packs') p
   where p->>'id' = 'p_region'),
  1, 'regional pack is returned inside its region');
select is(
  (select count(*)::integer from public.shop_categories where id = 'draftcat'),
  1, 'tester can read the draft category row');
reset role;

-- Retiring an art row lowers the card count.
update public.pack_art set status = 'retired' where art_id = 'a_live_s1';
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000c1', true);
set role authenticated;
select is(
  (select (p->>'itemCount')::integer from jsonb_array_elements(public.get_shop(1, 'US')->'packs') p
   where p->>'id' = 'p_live'),
  2, 'retiring a magnet drops the item count by one');
select is(
  (select count(*)::integer from public.shop_categories where id = 'draftcat'),
  0, 'normal account cannot read the draft category row');
reset role;

-- Owners keep retired/past packs: they arrive flagged hidden so only the
-- Owned chip shows them.
insert into public.user_entitlements (user_id, pack_id, source)
values ('a0000000-0000-0000-0000-0000000000c1', 'p_past', 'promo');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000c1', true);
set role authenticated;
select is(
  (select count(*)::integer from jsonb_array_elements(public.get_shop(1, 'US')->'packs') p
   where p->>'id' = 'p_past'),
  1, 'an owned pack past available_until is returned for the Owned chip');
select is(
  (select p->>'hidden' from jsonb_array_elements(public.get_shop(1, 'US')->'packs') p
   where p->>'id' = 'p_past'),
  'true', 'the owned past pack is flagged hidden for All/category sections');
reset role;

select * from finish();
rollback;
