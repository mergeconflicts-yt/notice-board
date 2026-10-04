-- Magnets and packs — local iteration v1 (docs/prd-magents-stickers.md §9).
-- Packs carry magnets, stickers and papers. Note *reactions* (the old
-- item_stickers feature) were dropped 2026-10-04; stickers are now flat
-- decorations placed on the door and stored in board_magnets alongside magnets.
--
-- ADD-ONLY migration (freeze in effect since the 2026-09-28 first push).
-- Local-only until proven out: iterate by adding follow-up migrations, never
-- by editing this file once pushed to hosted.
--
-- Scope: tables + columns + RLS + RPCs + realtime + Starter seed.
-- Out of scope for this pass: RevenueCat webhook, gift consumable grants,
-- bundle_of expansion, purge-function magnet conversion (M-6 full coords).
-- M-6 minimal: soft-delete of an item detaches its magnets to the door
-- (item_id NULL, x/y kept as-is; client clamps — coordinates are refined
-- once the board layout reports note positions).

-- ---------------------------------------------------------------------------
-- Catalogue (data, not code)
-- ---------------------------------------------------------------------------

create table public.pack_catalog (
  id text primary key,
  kind text not null check (kind in ('theme', 'travel', 'festival', 'bundle', 'gift')),
  name text not null,
  blurb text,
  store_product_id text,
  price_label text,
  sort integer not null default 100,
  status text not null default 'draft' check (status in ('draft', 'live', 'retired')),
  available_from timestamptz,
  available_until timestamptz,
  min_renderer integer not null default 1,
  spec jsonb not null default '{}'::jsonb,
  assets_version integer not null default 1,
  bundle_of text[]
);

create table public.pack_art (
  art_id text primary key,
  pack_id text not null references public.pack_catalog (id) on delete cascade,
  kind text not null check (kind in ('magnet', 'sticker', 'paper', 'fastener', 'door')),
  label text not null,
  path text not null,
  w integer,
  h integer
);
create index pack_art_pack_idx on public.pack_art (pack_id);

-- Store-verified ownership (webhook writes only; no client grants).
create table public.user_entitlements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  pack_id text not null,
  source text not null check (source in ('app_store', 'play', 'promo', 'free')),
  store_txn_id text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, pack_id)
);
create index user_entitlements_user_idx on public.user_entitlements (user_id)
  where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Decorations
-- ---------------------------------------------------------------------------

create table public.board_magnets (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  art_id text not null,
  pack_id text not null,
  item_id uuid references public.items (id) on delete set null,
  x double precision not null,
  y double precision not null,
  rotation real not null default 0,
  z bigint not null,
  placed_by uuid references public.profiles (id) on delete set null,
  gift_note text check (gift_note is null or char_length(gift_note) <= 28),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index board_magnets_board_idx on public.board_magnets (board_id);
create index board_magnets_item_idx on public.board_magnets (item_id)
  where item_id is not null;
create index board_magnets_board_z_idx on public.board_magnets (board_id, z);

alter table public.boards
  add column if not exists theme_pack text not null default 'starter';
alter table public.items
  add column if not exists paper_style text;

-- ---------------------------------------------------------------------------
-- RLS: reads only, membership-scoped, explicit grants only
-- ---------------------------------------------------------------------------

alter table public.pack_catalog enable row level security;
alter table public.pack_art enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.board_magnets enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles to authenticated;
grant select on public.boards to authenticated;
grant select on public.board_members to authenticated;
grant select on public.items to authenticated;
grant select on public.list_entries to authenticated;
grant select on public.photo_upload_intents to authenticated;
-- Re-assert catalogue + decoration reads (revoke-all above cleared defaults).
grant select on public.pack_catalog to authenticated;
grant select on public.pack_art to authenticated;
grant select on public.board_magnets to authenticated;
-- No grants on user_entitlements: only functions + webhook touch it.
-- NOTE: revoke-all above also strips the visible_items view grant, so re-assert it.
revoke all on public.visible_items from public, anon, authenticated;
grant select on public.visible_items to authenticated;

-- Catalogue: any signed-in user sees live rows (needed for the shop).
create policy pack_catalog_select on public.pack_catalog
  for select to authenticated
  using (status = 'live');
create policy pack_art_select on public.pack_art
  for select to authenticated
  using (
    exists (
      select 1 from public.pack_catalog c
      where c.id = pack_art.pack_id and c.status = 'live'
    )
  );
create policy board_magnets_select on public.board_magnets
  for select to authenticated
  using (public.is_member(board_id));

-- updated_at touch for magnets.
create trigger trg_touch_board_magnets_updated_at
  before insert or update on public.board_magnets
  for each row execute function public.touch_updated_at();

-- M-6 minimal: soft-delete (or hard update) of an item detaches its magnets.
-- x/y are kept as-is; the client clamps into door space on next render.
create function public.detach_magnets_from_item()
returns trigger
language plpgsql
security definer
set search_path = '' as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update public.board_magnets
    set item_id = null,
        updated_at = now(),
        version = version + 1
    where item_id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_detach_magnets_on_item_delete
  after update on public.items
  for each row execute function public.detach_magnets_from_item();

-- ---------------------------------------------------------------------------
-- Entitlement helper: free Starter always usable; otherwise any live
-- current member with an unrevoked grant unlocks the pack for the board.
-- Callable by clients (shop shows "Dad's" / greyed states).
-- ---------------------------------------------------------------------------

create function public.board_can_use(p_board_id uuid, p_pack_id text)
returns boolean
language sql
stable
security definer
set search_path = '' as $$
  select
    p_pack_id = 'starter'
    or exists (
      select 1
      from public.board_members m
      join public.user_entitlements e on e.user_id = m.user_id
      join public.boards b on b.id = m.board_id
      where m.board_id = p_board_id
        and e.pack_id = p_pack_id
        and e.revoked_at is null
        and b.deleted_at is null
    );
$$;

-- ---------------------------------------------------------------------------
-- Magnet RPCs
-- ---------------------------------------------------------------------------

create function public.place_magnet(
  p_board_id uuid,
  p_art_id text,
  p_x double precision,
  p_y double precision,
  p_item_id uuid default null,
  p_rotation real default 0,
  p_gift_note text default null
)
returns public.board_magnets
language plpgsql
security definer
set search_path = '' as $$
declare
  v_pack text;
  v_item_board uuid;
  v_count integer;
  v_z bigint;
  v_row public.board_magnets%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_member(p_board_id) then
    raise exception 'not_member';
  end if;
  if p_art_id is null or p_x is null or p_y is null then
    raise exception 'invalid_input';
  end if;
  if p_x < 0 or p_x > 1 or p_y < 0 or p_y > 20000
     or p_x = 'NaN'::double precision or p_y = 'NaN'::double precision
     or p_x = 'Infinity'::double precision or p_y = 'Infinity'::double precision then
    raise exception 'invalid_input';
  end if;
  if p_rotation is not null and (p_rotation < -20 or p_rotation > 20) then
    raise exception 'invalid_input';
  end if;
  if p_gift_note is not null and char_length(p_gift_note) > 28 then
    raise exception 'invalid_input';
  end if;
  -- Art must exist and be placeable decoration (magnet or sticker); pack
  -- derived server-side (no client invention).
  select pack_id into v_pack
  from public.pack_art
  where art_id = p_art_id and kind in ('magnet', 'sticker');
  if v_pack is null then
    raise exception 'invalid_input';
  end if;
  if not public.board_can_use(p_board_id, v_pack) then
    raise exception 'not_entitled';
  end if;
  -- Attached note must live on the same board and not be deleted.
  if p_item_id is not null then
    select board_id into v_item_board
    from public.items
    where id = p_item_id and deleted_at is null;
    if v_item_board is null or v_item_board != p_board_id then
      raise exception 'invalid_input';
    end if;
  end if;
  select count(*)::integer into v_count
  from public.board_magnets
  where board_id = p_board_id;
  if v_count >= 24 then
    raise exception 'board_full';
  end if;
  perform public.hit_rate_limit('item_write', 600, interval '1 hour');
  select coalesce(max(z), 0) + 1 into v_z
  from public.board_magnets
  where board_id = p_board_id;
  insert into public.board_magnets
    (board_id, art_id, pack_id, item_id, x, y, rotation, z, placed_by, gift_note)
  values
    (p_board_id, p_art_id, v_pack, p_item_id, p_x, p_y,
     coalesce(p_rotation, 0), v_z, auth.uid(),
     case when p_gift_note is null then null else btrim(p_gift_note) end)
  returning * into v_row;
  return v_row;
end;
$$;

create function public.move_magnet(
  p_id uuid,
  p_x double precision,
  p_y double precision,
  p_item_id uuid default null,
  p_expected_version integer default null
)
returns public.board_magnets
language plpgsql
security definer
set search_path = '' as $$
declare
  v_row public.board_magnets%rowtype;
  v_item_board uuid;
  v_z bigint;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_row from public.board_magnets where id = p_id for update;
  if v_row.id is null then
    raise exception 'not_found';
  end if;
  if not public.is_member(v_row.board_id) then
    raise exception 'not_member';
  end if;
  if p_x is null or p_y is null then
    raise exception 'invalid_input';
  end if;
  if p_x < 0 or p_x > 1 or p_y < 0 or p_y > 20000 then
    raise exception 'invalid_input';
  end if;
  -- Any member can move (shared fridge); version guards lost updates.
  if p_expected_version is not null and v_row.version != p_expected_version then
    raise exception 'version_conflict';
  end if;
  if p_item_id is not null then
    select board_id into v_item_board
    from public.items
    where id = p_item_id and deleted_at is null;
    if v_item_board is null or v_item_board != v_row.board_id then
      raise exception 'invalid_input';
    end if;
  end if;
  perform public.hit_rate_limit('item_write', 600, interval '1 hour');
  select coalesce(max(z), 0) + 1 into v_z
  from public.board_magnets
  where board_id = v_row.board_id;
  update public.board_magnets
  set x = p_x,
      y = p_y,
      item_id = p_item_id,
      z = v_z,
      updated_at = now(),
      version = v_row.version + 1
  where id = p_id
  returning * into v_row;
  return v_row;
end;
$$;

create function public.remove_magnet(p_id uuid)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_row public.board_magnets%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_row from public.board_magnets where id = p_id for update;
  if v_row.id is null then
    raise exception 'not_found';
  end if;
  if not public.is_member(v_row.board_id) then
    raise exception 'not_member';
  end if;
  -- Author only: even the board owner cannot take off someone else's magnet.
  if v_row.placed_by is distinct from auth.uid() then
    raise exception 'not_allowed';
  end if;
  perform public.hit_rate_limit('item_write', 600, interval '1 hour');
  delete from public.board_magnets where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Theme: owner sets the door finish; entitlement checked.
-- ---------------------------------------------------------------------------

create function public.set_board_theme(p_board_id uuid, p_pack_id text)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_role public.member_role;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  perform 1 from public.boards where id = p_board_id for update;
  if not exists (select 1 from public.boards where id = p_board_id and deleted_at is null) then
    raise exception 'not_member';
  end if;
  select role into v_role
  from public.board_members
  where board_id = p_board_id and user_id = auth.uid();
  if v_role is null then
    raise exception 'not_member';
  end if;
  if v_role is distinct from 'owner' then
    raise exception 'not_owner';
  end if;
  if p_pack_id is null then
    raise exception 'invalid_input';
  end if;
  if not exists (select 1 from public.pack_catalog where id = p_pack_id and status = 'live') then
    raise exception 'invalid_input';
  end if;
  if not public.board_can_use(p_board_id, p_pack_id) then
    raise exception 'not_entitled';
  end if;
  perform public.hit_rate_limit('item_write', 600, interval '1 hour');
  update public.boards
  set theme_pack = p_pack_id,
      updated_at = now()
  where id = p_board_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: API functions to authenticated; helpers stay revoked.
-- ---------------------------------------------------------------------------

revoke all on function public.board_can_use(uuid, text) from public, anon;
grant execute on function public.board_can_use(uuid, text) to authenticated;
revoke all on function public.place_magnet(uuid, text, double precision, double precision, uuid, real, text) from public, anon;
grant execute on function public.place_magnet(uuid, text, double precision, double precision, uuid, real, text) to authenticated;
revoke all on function public.move_magnet(uuid, double precision, double precision, uuid, integer) from public, anon;
grant execute on function public.move_magnet(uuid, double precision, double precision, uuid, integer) to authenticated;
revoke all on function public.remove_magnet(uuid) from public, anon;
grant execute on function public.remove_magnet(uuid) to authenticated;
revoke all on function public.set_board_theme(uuid, text) from public, anon;
grant execute on function public.set_board_theme(uuid, text) to authenticated;
revoke execute on function public.detach_magnets_from_item() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: board decorations go live like items.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'board_magnets'
  ) then
    alter publication supabase_realtime add table public.board_magnets;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Packs storage bucket (public art, ownership enforced by RPCs not secrecy).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'packs', 'packs', true, 10485760,
  '{image/webp,image/png}'::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Starter seed (free pack; bundled in-app, mirrored here for entitlement checks).
-- ---------------------------------------------------------------------------

insert into public.pack_catalog (id, kind, name, blurb, status, sort, min_renderer, spec)
values (
  'starter', 'theme', 'Starter', 'Current magnets, souvenirs, stickers and papers.',
  'live', 0, 1,
  '{"door": {"light": "#FBEFD0", "base": "#F3E2B3", "shade": "#DCC791", "handle": "chrome", "titleInk": "#7A2E22"}, "papers": [{"id": "plain"}, {"id": "grid"}, {"id": "ruled"}, {"id": "kraft"}, {"id": "recipe"}, {"id": "legal"}, {"id": "linen"}], "magnets": ["st_fuji", "st_boba", "st_bus", "st_cat", "st_shell"], "stickers": ["st_love", "st_gotit", "st_done", "st_great", "st_haha", "st_thanks", "st_yum", "st_onit"]}'::jsonb
)
on conflict (id) do update set
  status = excluded.status,
  spec = excluded.spec;

insert into public.pack_art (art_id, pack_id, kind, label, path) values
  ('st_fuji', 'starter', 'magnet', 'Mt. Fuji', 'assets/packs/starter/st_fuji@3x.webp'),
  ('st_boba', 'starter', 'magnet', 'Bubble tea', 'assets/packs/starter/st_boba@3x.webp'),
  ('st_bus', 'starter', 'magnet', 'City bus', 'assets/packs/starter/st_bus@3x.webp'),
  ('st_cat', 'starter', 'magnet', 'Fridge cat', 'assets/packs/starter/st_cat@3x.webp'),
  ('st_shell', 'starter', 'magnet', 'Seashell', 'assets/packs/starter/st_shell@3x.webp'),
  ('st_love', 'starter', 'sticker', 'Love', 'packs/starter/v1/st_love@3x.webp'),
  ('st_gotit', 'starter', 'sticker', 'Got it', 'packs/starter/v1/st_gotit@3x.webp'),
  ('st_done', 'starter', 'sticker', 'Done', 'packs/starter/v1/st_done@3x.webp'),
  ('st_great', 'starter', 'sticker', 'Great', 'packs/starter/v1/st_great@3x.webp'),
  ('st_haha', 'starter', 'sticker', 'Haha', 'packs/starter/v1/st_haha@3x.webp'),
  ('st_thanks', 'starter', 'sticker', 'Thanks', 'packs/starter/v1/st_thanks@3x.webp'),
  ('st_yum', 'starter', 'sticker', 'Yum', 'packs/starter/v1/st_yum@3x.webp'),
  ('st_onit', 'starter', 'sticker', 'On it', 'packs/starter/v1/st_onit@3x.webp')
on conflict (art_id) do nothing;
