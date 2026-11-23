-- Magnet types (docs/agent-guide-magnet-types.md §1).
--
-- ADD-ONLY migration (freeze in effect). Every existing art row is an
-- "object"; future word/badge/place/team/letter/photo/holder/live art uses the
-- same column. The app still renders one thing: a magnet.

alter table public.pack_art
  add column type text not null default 'object'
  check (type in (
    'object', 'word', 'badge', 'place', 'team',
    'letter', 'photo', 'holder', 'live'
  ));

create index pack_art_pack_type_idx on public.pack_art (pack_id, type, status);
