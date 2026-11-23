-- Magnet types (migration 20261123000025_magnet_types).
begin;
select plan(3);

insert into public.pack_catalog (id, kind, name, status)
values ('type_pack', 'theme', 'Type pack', 'live');

insert into public.pack_art (art_id, pack_id, kind, label, path)
values ('type_default', 'type_pack', 'magnet', 'Default', 'packs/type_pack/v1/default@3x.webp');
insert into public.pack_art (art_id, pack_id, kind, label, path, type)
values ('type_word', 'type_pack', 'magnet', 'Word', 'packs/type_pack/v1/word@3x.webp', 'word');

select is(
  (select type from public.pack_art where art_id = 'type_default'),
  'object', 'existing/default art is an object magnet');
select is(
  (select type from public.pack_art where art_id = 'type_word'),
  'word', 'a magnet can be a word magnet');
select throws_ok(
  $$insert into public.pack_art (art_id, pack_id, kind, label, path, type)
    values ('type_bad', 'type_pack', 'magnet', 'Bad', 'packs/type_pack/v1/bad@3x.webp', 'not-a-type')$$,
  '23514', null, 'unknown magnet type is rejected');

select * from finish();
rollback;
