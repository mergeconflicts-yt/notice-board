-- Pack detail (migration 20261123000024_pack_detail).
begin;
select plan(7);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-0000000000d2', 'authenticated', 'authenticated');
insert into public.shop_testers (user_id)
values ('a0000000-0000-0000-0000-0000000000d2');

insert into public.shop_categories (id, title, layout, sort, status)
values ('detailcat', 'Detail things', 'grid', 10, 'live');

insert into public.pack_catalog
  (id, kind, name, status, sort, category_id, store_product_id, spec, available_until)
values
  ('d_live', 'theme', 'Detail live', 'live', 10, 'detailcat', 'prod_detail_live',
   '{"door":{"base":"#2E5B3E","handle":"steel"},"papers":[{"id":"canary","bg":"#F4D169"}]}'::jsonb, null),
  ('d_past', 'theme', 'Detail past', 'live', 20, 'detailcat', 'prod_detail_past',
   '{}'::jsonb, now() - interval '1 day'),
  ('d_draft', 'theme', 'Detail draft', 'draft', 30, 'detailcat', 'prod_detail_draft',
   '{}'::jsonb, null);

insert into public.pack_art (art_id, pack_id, kind, label, path, status, sort) values
  ('d_m1', 'd_live', 'magnet', 'Magnet', 'packs/d_live/v1/m1@3x.webp', 'live', 10),
  ('d_s1', 'd_live', 'sticker', 'Sticker', 'packs/d_live/v1/s1@3x.webp', 'live', 20),
  ('d_p1', 'd_live', 'paper', 'Paper', 'packs/d_live/v1/p1@3x.webp', 'live', 30),
  ('d_f1', 'd_live', 'fastener', 'Clip', 'packs/d_live/v1/f1@3x.webp', 'live', 40),
  ('d_m2', 'd_live', 'magnet', 'Retired', 'packs/d_live/v1/m2@3x.webp', 'retired', 50);

insert into public.user_entitlements (user_id, pack_id, source)
values ('a0000000-0000-0000-0000-0000000000d1', 'd_past', 'promo');

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000d1', true);
set role authenticated;
select isnt(public.get_pack_detail('d_live', 1, 'US'), null, 'visible pack detail loads');
select is(
  public.get_pack_detail('d_live', 1, 'US') -> 'pack' ->> 'id',
  'd_live', 'detail returns the requested pack');
select is(
  public.get_pack_detail('d_live', 1, 'US') -> 'pack' -> 'spec' -> 'door' ->> 'base',
  '#2E5B3E', 'detail includes the renderer spec');
select is(
  jsonb_array_length(public.get_pack_detail('d_live', 1, 'US') -> 'art'),
  4, 'detail art excludes retired rows');
select is(
  public.get_pack_detail('d_past', 1, 'US') -> 'pack' ->> 'hidden',
  'true', 'an owned past pack still opens for its owner');
select is(
  public.get_pack_detail('d_draft', 1, 'US'),
  null, 'a hidden non-owned draft pack does not open');
reset role;

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000d2', true);
set role authenticated;
select isnt(public.get_pack_detail('d_draft', 1, 'US'), null, 'tester can open a draft pack');
reset role;

select * from finish();
rollback;
