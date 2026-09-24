-- Harden boards + board_members for the shared-board architecture.
-- Additive only: existing clients keep working.

-- Boards: audit trail, optimistic-concurrency version, per-board settings.
alter table public.boards
  add column if not exists created_by uuid references auth.users (id) on delete cascade,
  add column if not exists updated_by uuid references auth.users (id) on delete cascade,
  add column if not exists updated_at timestamptz,
  add column if not exists deleted_by uuid references auth.users (id) on delete cascade,
  add column if not exists deleted_at timestamptz,
  add column if not exists version integer not null default 1,
  add column if not exists settings jsonb not null default '{}';

-- Backfill audit fields from what we know: the owner created it.
update public.boards
set created_by = owner_id
where created_by is null;

update public.boards
set updated_by = owner_id,
    updated_at = created_at
where updated_by is null or updated_at is null;

-- Members: roles + lifecycle. Owner is whoever owns the board.
alter table public.board_members
  add column if not exists role text not null default 'member',
  add column if not exists invited_by uuid references auth.users (id) on delete set null,
  add column if not exists removed_by uuid references auth.users (id) on delete set null,
  add column if not exists removed_at timestamptz,
  add column if not exists left_at timestamptz;

update public.board_members bm
set role = 'owner'
from public.boards b
where bm.board_id = b.id
  and bm.user_id = b.owner_id
  and bm.role <> 'owner';

alter table public.board_members
  drop constraint if exists board_members_role_check,
  add constraint board_members_role_check check (role in ('owner', 'admin', 'member'));
