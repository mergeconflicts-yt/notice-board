-- Notice Board — Supabase schema
-- Run this in the Supabase SQL editor once to create the tables, RLS
-- policies, and realtime publications. Auth uses anonymous sign-ins.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar text,
  created_at timestamptz not null default now()
);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.board_members (
  board_id uuid not null references public.boards (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  image_url text,
  color text not null default 'yellow',
  rotation real not null default 0,
  position_x real not null default 0.5,
  position_y real not null default 0.5,
  kind text not null default 'note',
  data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  completed_at timestamptz
);

create index if not exists notes_board_id_idx on public.notes (board_id);
create index if not exists board_members_user_idx on public.board_members (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.notes enable row level security;

-- profiles: everyone signed in can read; users manage their own row.
create policy "profiles_read" on public.profiles
  for select using (true);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- boards: anyone signed in can create/read (needed to look up by invite code).
-- Only the owner can update or delete.
create policy "boards_read" on public.boards
  for select using (true);
create policy "boards_insert" on public.boards
  for insert with check (auth.uid() = owner_id);
create policy "boards_update_owner" on public.boards
  for update using (auth.uid() = owner_id);
create policy "boards_delete_owner" on public.boards
  for delete using (auth.uid() = owner_id);

-- board_members: anyone signed in can read/join.
create policy "members_read" on public.board_members
  for select using (true);
create policy "members_insert" on public.board_members
  for insert with check (auth.uid() = user_id);
create policy "members_delete_self" on public.board_members
  for delete using (auth.uid() = user_id);

-- notes: read/insert/update/delete for members of the board.
create policy "notes_read_member" on public.notes
  for select using (
    exists (
      select 1 from public.board_members bm
      where bm.board_id = notes.board_id and bm.user_id = auth.uid()
    )
  );
create policy "notes_insert_member" on public.notes
  for insert with check (
    auth.uid() = author_id and
    exists (
      select 1 from public.board_members bm
      where bm.board_id = notes.board_id and bm.user_id = auth.uid()
    )
  );
create policy "notes_update_member" on public.notes
  for update using (
    exists (
      select 1 from public.board_members bm
      where bm.board_id = notes.board_id and bm.user_id = auth.uid()
    )
  );
create policy "notes_delete_member" on public.notes
  for delete using (
    exists (
      select 1 from public.board_members bm
      where bm.board_id = notes.board_id and bm.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.notes;
alter publication supabase_realtime add table public.board_members;
alter publication supabase_realtime add table public.boards;
alter publication supabase_realtime add table public.profiles;

-- ---------------------------------------------------------------------------
-- Storage (for pinned photos)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('notes', 'notes', true)
on conflict (id) do nothing;

create policy "notes_images_read" on storage.objects
  for select using (bucket_id = 'notes');
create policy "notes_images_insert" on storage.objects
  for insert with check (bucket_id = 'notes' and auth.role() = 'authenticated');
