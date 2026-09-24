-- User-cleanup safety: deleting an auth user must never wipe shared content.
--
-- Actor/owner links that previously used ON DELETE CASCADE now use
-- ON DELETE SET NULL, so removing an account (e.g. pruning old anonymous
-- users) only clears attribution — the board and its posts survive for
-- everyone else. Columns that were NOT NULL become nullable to allow that.
--
-- Intentionally still CASCADE (a deleted user takes only their own rows):
--   * profiles.id → auth.users (the profile IS the user)
--   * user_settings.user_id → profiles (per-user preferences)
--   * board_members.user_id → auth.users / profiles (user_id is part of the
--     PK, so it cannot be nulled; only that user's membership row goes away)
-- Board-scoped content (board_items, list_entries, item_assets, invites,
-- events) still cascades off boards — deleting a BOARD removes its content,
-- but deleting a USER no longer removes any board.

-- ---------------------------------------------------------------------------
-- boards.owner_id: a shared board survives its owner.
-- ---------------------------------------------------------------------------

alter table public.boards
  alter column owner_id drop not null;

alter table public.boards
  drop constraint if exists boards_owner_id_fkey;

alter table public.boards
  add constraint boards_owner_id_fkey
  foreign key (owner_id) references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- boards audit stamps: whoever created/updated/deleted last must never own
-- the row's lifetime.
-- ---------------------------------------------------------------------------

alter table public.boards
  drop constraint if exists boards_created_by_fkey;

alter table public.boards
  add constraint boards_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

alter table public.boards
  drop constraint if exists boards_updated_by_fkey;

alter table public.boards
  add constraint boards_updated_by_fkey
  foreign key (updated_by) references auth.users (id) on delete set null;

alter table public.boards
  drop constraint if exists boards_deleted_by_fkey;

alter table public.boards
  add constraint boards_deleted_by_fkey
  foreign key (deleted_by) references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- notes.author_id (legacy table): posts outlive their author. Both the
-- auth.users link and the profiles link (added for PostgREST embeds) are
-- switched; the column becomes nullable.
-- ---------------------------------------------------------------------------

alter table public.notes
  alter column author_id drop not null;

alter table public.notes
  drop constraint if exists notes_author_id_fkey;

alter table public.notes
  add constraint notes_author_id_fkey
  foreign key (author_id) references auth.users (id) on delete set null;

alter table public.notes
  drop constraint if exists notes_author_id_profiles_fkey;

alter table public.notes
  add constraint notes_author_id_profiles_fkey
  foreign key (author_id) references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- board_items.created_by: items outlive their creator (already nullable).
-- The remaining actor columns on board_items / list_entries / item_assets /
-- board_invites / board_events carry no foreign key, so there is nothing to
-- change there — deleting a user already leaves those stamps untouched.
-- ---------------------------------------------------------------------------

alter table public.board_items
  drop constraint if exists board_items_created_by_fkey;

alter table public.board_items
  add constraint board_items_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;
