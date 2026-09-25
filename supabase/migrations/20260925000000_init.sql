-- Notice Board backend, phase 1 (docs/plan.md): single init migration.
-- Fresh schema for a new project: RPC-only writes (no table write
-- policies at all), member-scoped RLS reads, server-decided lifetimes.
-- Clients never receive grants beyond SELECT on the read tables plus the
-- board view; every mutation goes through a SECURITY DEFINER function
-- (added in later phase-1 batches).

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type member_role as enum ('owner', 'member');
create type item_type as enum ('note', 'list', 'date', 'photo');
create type item_color as enum ('butter', 'blush', 'sage', 'sky', 'lavender', 'peach', 'paper');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  avatar_path text check (
    avatar_path is null
    or (char_length(avatar_path) <= 200
        and avatar_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  color text not null default 'sage'
    check (color in ('sage', 'blue', 'clay', 'cream', 'charcoal')),
  timezone text not null default 'UTC',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.board_members (
  board_id uuid not null references public.boards (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create table public.items (
  id uuid primary key,
  board_id uuid not null references public.boards (id) on delete cascade,
  type item_type not null,
  color item_color not null default 'butter',
  body text check (char_length(body) <= 2000),
  title text check (char_length(title) <= 120),
  event_at timestamptz,
  place text check (char_length(place) <= 120),
  photo_path text check (
    photo_path is null
    or (char_length(photo_path) <= 200
        and photo_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$')
  ),
  pinned boolean not null default false,
  keep_until timestamptz,
  done_at timestamptz,
  done_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, board_id),
  check (type != 'date' or event_at is not null),
  check (type != 'photo' or photo_path is not null),
  check (type != 'note' or char_length(btrim(coalesce(body, ''))) > 0)
);

create table public.list_entries (
  id uuid primary key,
  item_id uuid not null,
  board_id uuid not null,
  foreign key (item_id, board_id) references public.items (id, board_id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 200),
  position double precision not null,
  checked_at timestamptz,
  checked_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  token_hash bytea not null unique,
  code_hash bytea not null unique,
  secret_enc bytea not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz
);

-- One active invite per board; expired rows are replaced by get_invite_link.
create unique index invites_one_active_idx on public.invites (board_id)
  where revoked_at is null;

create table public.rate_limits (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  primary key (user_id, action, window_start)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index items_board_created_idx on public.items (board_id, created_at desc)
  where deleted_at is null;
-- Delta catch-up reads (`updated_at > since`) and purge cascades.
create index items_board_updated_idx on public.items (board_id, updated_at);
-- list_removed_items (board + already deleted).
create index items_board_deleted_idx on public.items (board_id, deleted_at)
  where deleted_at is not null;
create index items_keep_until_idx on public.items (keep_until)
  where deleted_at is null and keep_until is not null;
create index items_deleted_at_idx on public.items (deleted_at)
  where deleted_at is not null;
create index list_entries_item_position_idx on public.list_entries (item_id, position);
create index list_entries_board_idx on public.list_entries (board_id);
create index board_members_user_idx on public.board_members (user_id);
create index invites_board_idx on public.invites (board_id);
create index invites_created_by_idx on public.invites (created_by);

-- "Who did it" columns: indexed so account deletion (which nulls these on
-- ON DELETE SET NULL) and audits don't scan the whole table.
create index items_created_by_idx on public.items (created_by);
create index items_done_by_idx on public.items (done_by);
create index items_updated_by_idx on public.items (updated_by);
create index items_deleted_by_idx on public.items (deleted_by);
create index list_entries_created_by_idx on public.list_entries (created_by);
create index list_entries_checked_by_idx on public.list_entries (checked_by);
create index boards_created_by_idx on public.boards (created_by);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at touch + automatic profile rows
-- ---------------------------------------------------------------------------

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_touch_profiles_updated_at
  before insert or update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger trg_touch_boards_updated_at
  before insert or update on public.boards
  for each row execute function public.touch_updated_at();
create trigger trg_touch_items_updated_at
  before insert or update on public.items
  for each row execute function public.touch_updated_at();
create trigger trg_touch_list_entries_updated_at
  before insert or update on public.list_entries
  for each row execute function public.touch_updated_at();

-- A profile row appears automatically for every new auth user (including
-- anonymous sign-ins). Runs as definer so it works with no table writes
-- granted to client roles.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, 'Someone')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-level security: reads only, membership-scoped, explicit grants only
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.items enable row level security;
alter table public.list_entries enable row level security;
alter table public.invites enable row level security;
alter table public.rate_limits enable row level security;

-- No table writes for client roles, ever: mutations go through functions.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles to authenticated;
grant select on public.boards to authenticated;
grant select on public.board_members to authenticated;
grant select on public.items to authenticated;
grant select on public.list_entries to authenticated;
-- No grants at all on invites and rate_limits: only functions touch them.

-- Membership helper for policies and functions. Definer so policy checks
-- never recurse into RLS; excludes soft-deleted boards.
create function public.is_member(p_board uuid)
returns boolean
language sql
stable
security definer
set search_path = '' as $$
  select exists (
    select 1
    from public.board_members m
    join public.boards b on b.id = m.board_id
    where m.board_id = p_board
      and m.user_id = auth.uid()
      and b.deleted_at is null
  );
$$;

-- Select policies, authenticated only. There are intentionally no
-- insert/update/delete policies on any table.
create policy boards_select on public.boards
  for select to authenticated
  using (public.is_member(id));

create policy board_members_select on public.board_members
  for select to authenticated
  using (public.is_member(board_id));

create policy items_select on public.items
  for select to authenticated
  using (public.is_member(board_id));

create policy list_entries_select on public.list_entries
  for select to authenticated
  using (public.is_member(board_id));

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.board_members m1
      join public.board_members m2 on m2.board_id = m1.board_id
      where m1.user_id = auth.uid()
        and m2.user_id = profiles.id
    )
  );

-- Board screen view: live items only. Invoker rights so RLS still applies;
-- needs its own grant because auto-expose is off.
create view public.visible_items with (security_invoker = true) as
  select *
  from public.items
  where deleted_at is null
    and (keep_until is null or keep_until > now());

-- Explicit grants only (views get no PUBLIC access by default, but be explicit).
revoke all on public.visible_items from public, anon;
grant select on public.visible_items to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: board content only. Never profiles, invites, rate_limits.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items'
  ) then
    alter publication supabase_realtime add table public.items;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'list_entries'
  ) then
    alter publication supabase_realtime add table public.list_entries;
  end if;
  -- board_members is deliberately NOT published: Supabase doesn't apply RLS to
  -- DELETE events, so every subscriber would learn who left any board. The
  -- member list refreshes on focus/foreground instead.
end
$$;

-- ---------------------------------------------------------------------------
-- Storage buckets (policies land with phase 3, photos)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'board-photos', 'board-photos', false, 10485760,
  '{image/jpeg,image/webp,image/heic}'::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', false, 5242880,
  '{image/jpeg,image/webp,image/png,image/heic}'::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Lifetime rules: single source of truth for keep_until defaults.
-- Used by post_item, set_pinned, set_done (undo path) and edit_item.
-- Lists stay NULL here; the +2-days-after-all-checked rule runs inside the
-- entry functions. The done case (done_at + 2 days) is applied directly by
-- set_done; undoing done re-enters through this function.
-- ---------------------------------------------------------------------------

create function public.default_keep_until(
  p_type item_type,
  p_event_at timestamptz,
  p_pinned boolean,
  p_now timestamptz,
  p_timezone text
)
returns timestamptz
language sql
stable
set search_path = '' as $$
  select case
    when p_pinned then null
    when p_type = 'note' then p_now + interval '7 days'
    when p_type = 'photo' then p_now + interval '14 days'
    -- Start of the day AFTER the event, in the board's time zone.
    when p_type = 'date' then
      (date_trunc('day', p_event_at at time zone p_timezone) + interval '1 day')
        at time zone p_timezone
    else null
  end;
$$;
