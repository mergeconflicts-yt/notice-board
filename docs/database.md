# Database

Postgres, managed through ordered migrations in `supabase/migrations/`
(never hand-edit the database; never edit an applied migration — add a new one).
Legacy one-shot file `supabase/schema.sql` was removed; migrations are the
only entry point.

## Conventions

- **Board security rule.** Every board-scoped row carries `board_id`, and RLS
  allows access only to that board's members, via the `is_board_member()`
  helper (a `SECURITY DEFINER` function, so policies don't recurse).
- **Write boundary.** Clients never send actor fields (`created_by`,
  `updated_by`, …), timestamps, or versions. `BEFORE` stamp triggers fill
  those from `auth.uid()` whenever a signed-in caller writes; anonymous
  migration/service writes pass through untouched. Every actor WHO-column
  (`completed_by`, `checked_by`, `uploaded_by`, `deleted_by`) is
  server-decided too: stamped on the transition that implies the action
  (or on insert when the flag arrives set), pinned to the old value
  otherwise — so a member can never make it look like someone else
  posted, ticked, completed, or deleted something.
- **Soft deletes.** `board_items`, `list_entries`, `boards` (and `notes`
  legacy-side via `completed_at`) use `deleted_by`/`deleted_at`. Setting or
  clearing `deleted_at` stamps/clears `deleted_by` and logs `delete`/`restore`
  audit actions. Nothing in the app hard-deletes except board cleanup paths.
- **Versions.** `boards`, `board_items`, `list_entries` carry an integer
  `version`, bumped by triggers on every update — the optimistic-concurrency
  token the API checks.
- **User deletion.** Deleting an auth user only clears attribution
  (`boards.owner_id` / audit stamps, `notes.author_id`,
  `board_items.created_by` are `ON DELETE SET NULL`). Boards and posts
  survive; only the user's own profile, settings, and membership rows go
  away with them.
- **Visibility.** Profiles and photos are member-scoped, never public:
  a profile is readable only by its owner and co-members of a shared
  board; a legacy-bucket photo only by members of a board whose notes
  reference it. Anonymous sign-ins are free, so "signed in" alone grants
  nothing — every read policy keys off `board_members`.

## Tables (`public` schema unless noted)

### `profiles`
One row per auth user. `id uuid PK → auth.users`, `display_name text NOT NULL`,
`avatar text NULL`, `created_at timestamptz`.

### `user_settings`
One row per profile. `user_id uuid PK → profiles ON DELETE CASCADE`,
`last_board_id uuid NULL → boards ON DELETE SET NULL`, `locale`/`timezone`
nullable text, `theme` in (`system`,`light`,`dark`), `reduce_motion bool`.

### `boards`
`id`, `name text`, `owner_id → auth.users ON DELETE SET NULL`, nullable
(original creator, immutable; null once their account is gone — the board
survives), `invite_code text UNIQUE NOT NULL` (legacy; new boards get a
dummy `v2-…` value — invites live in `board_invites` now), `created_by/at`,
`updated_by/at`, `deleted_by/at` (soft delete; the user links are
`ON DELETE SET NULL`), `version`, `settings jsonb`.

### `board_members`
PK (`board_id`, `user_id`). `role` in (`owner`,`admin`,`member`) — the owner
is backfilled from `boards.owner_id`. `joined_at`, `invited_by`,
`removed_by/at`, `left_at`.

### `board_invites`
Shareable join tokens. Only the **hash** is stored (`token_hash text UNIQUE`);
the raw `XXXX-XXXX` token is returned once at creation. `board_id`,
`created_by/at`, `expires_at NULL`, `max_uses NULL` (= unlimited),
`use_count`, `accepted_by/at` (first acceptance), `revoked_by/at`.

### `board_items` (realtime)
The note itself. `id`, `board_id`, `type` (`note`/`photo`/`list`/`date`),
`body text NULL` (text/caption, or a list's title), `event_at` (dates),
`expires_at`, `paper jsonb` (`{color, rotation, …}`),
`layout jsonb NULL` (`{x, y, manual}` only when hand-placed; null = auto),
`created/updated/completed/deleted_by + _at`, `version`.
`created_by → profiles ON DELETE SET NULL` (null once the creator's account
is gone — the item survives); the other actor stamps carry no FK.

### `list_entries` (realtime)
Checklist rows. `id`, `board_id`, `item_id → board_items ON DELETE CASCADE`,
`text`, `position int` (order within the item), `is_checked`,
`checked_by/at` (stamped when the flag flips), plus created/updated/deleted
audit cols and `version`.

### `item_assets`
Photo bytes metadata. `id`, `board_id`, `item_id → board_items CASCADE`,
`storage_path text UNIQUE` (`board/<board>/item/<item>/<file>`),
`mime`, `bytes`, `width`, `height`, `blurhash` (nullable; filled when known),
`uploaded_by/at`.

### `board_events` (append-only)
Audit trail. `id`, `board_id`, `actor_id NULL` (null = server-side write),
`entity_type` (`board`/`member`/`item`/`entry`/`asset`), `entity_id`,
`action` (`insert`/`update`/`delete`/`restore`; hard `DELETE`s log `delete`),
`metadata jsonb` (`{before, after}` row snapshots — what makes restore work),
`request_id NULL` (reserved for client idempotency keys), `created_at`.

### `notes` (legacy, frozen)
The original table (`author_id NULL → auth.users / profiles
ON DELETE SET NULL`, `text`, `image_url`, `color`, `rotation`,
`position_x/y`, `kind`, `data`, timestamps, `expires_at`, `completed_at`).
Kept so old clients keep working; superseded by `board_items` and friends.
Do not extend it.

## Row-level security

| Table | Policy | Effect |
|---|---|---|
| `boards` | `boards_member_read` (SELECT) | members only |
| `boards` | `boards_update_owner` (UPDATE) | owner only |
| `boards` | `boards_delete_owner` (DELETE) | owner only |
| `board_members` | `board_members_member_read` (SELECT) | members of that board only |
| `board_members` | `members_delete_self` (DELETE) | leave = delete own row |
| `board_members` | *(no insert/update)* | membership only via `create_board` / `accept_board_invite` RPCs |
| `board_items`, `list_entries`, `item_assets` | `*_member_all` (ALL) | full CRUD for members; deletes flow through soft-delete convention |
| `board_invites` | `board_invites_member_read` (SELECT) | members can list/manage; all writes via RPCs |
| `board_events` | `board_events_member_read` (SELECT) | read-only trail; only triggers insert |
| `profiles` | `profiles_member_read` (SELECT: own row + co-members of a shared board); insert/update own row | anon key alone lists nothing |
| `user_settings` | select/insert/update own row | — |
| `notes` (legacy) | member read/insert/update/delete | unchanged |
| `storage.objects` | `board_media_member_*` (SELECT/INSERT/UPDATE/DELETE) | path must be `board/<id>/…` and caller a member of `<id>` |
| `storage.objects` | `notes_images_member_read` (SELECT: object referenced by a note on a caller's board), `notes_images_member_upload` (INSERT: board members, own `<uid>/…` folder), `notes_images_owner_delete` (DELETE: own folder) | legacy bucket is private; no update policy |

## Realtime publication (`supabase_realtime`)

`board_items`, `list_entries`, `item_assets`, plus the pre-existing
`boards`, `board_members`, `notes`, `profiles`.

## Functions & triggers

| Name | Kind | Purpose |
|---|---|---|
| `is_board_member(uuid)` | `SECURITY DEFINER` SQL | membership check for RLS (no recursion) |
| `create_board(name)` | RPC (definer) | inserts board + founder-owner membership atomically; returns the row |
| `create_board_invite(board, max_uses?, expires_at?)` | RPC (definer) | member-only; returns `{invite_id, token}` once |
| `accept_board_invite(token)` | RPC (definer) | locks the invite row, validates (exists/revoked/expiry/uses), inserts membership idempotently, consumes a use **only** on a real insert; returns `board_id` |
| `revoke_board_invite(id)` | RPC (definer) | member-only revocation |
| `create_list_item(board, body, paper, layout, expires, entries[])` | RPC (definer) | item + all entries in one transaction; returns item id |
| `_stamp_boards/items/entries/assets()` | `BEFORE` triggers | actor fields, timestamps, versions; infers `deleted_by`, `checked_by`, `completed_by` from their flag transitions |
| `_audit_board_event()` | `AFTER` trigger (definer) on all five board tables | appends `board_events` with before/after snapshots; derives `delete`/`restore` |
| `_split_marked_list(text)` | immutable helper | checklist text → `{title, items[]}` (kept for imports) |
| `_media_board_id(path)` | immutable helper | safe board-id extraction for storage policies |

Dropped after serving: `migrate_notes_to_board_items()` (legacy backfill).

## Storage

| Bucket | Visibility | Used by |
|---|---|---|
| `board-media` | **private** | v2 photo flow; clients use time-boxed signed URLs only |
| `notes` | **private** (legacy; flipped unconditionally — public buckets bypass RLS) | member-scoped reads via note references; run `scripts/migrate-legacy-photos.cjs` to move leftovers into `board-media` (legacy public URLs stop resolving until moved) |

## Migrations (in order)

1. `20260923032532_initial_schema` — original tables, RLS, realtime, `notes` bucket.
2. `20260923033000_note_author_profile_fk` — `profiles(*)` embeds for notes/members.
3. `20260923033908_harden_boards_members` — audit cols, `version`, `settings`, roles.
4. `20260923034843_board_invites` — invite table + three RPCs.
5. `20260923034930_user_settings` — preferences table.
6. `20260923035000_board_items_lists_assets` — new content model + legacy backfill.
7. `20260923035043_board_events_write_boundary` — audit table, stamp/audit triggers (+ assets on realtime).
8. `20260923035120_board_media_bucket` — private bucket + member policies.
9. `20260923040115_boards_invite_code_default` — dummy codes so v2 writes only send `{name}`.
10. `20260924061012_board_privacy` — member-only RLS, `is_board_member`, `create_board` RPC.
11. `20260924061100_drop_backfill` — backfill RPC revoked + dropped.
12. `20260924061200_invite_row_lock` — `FOR UPDATE` + consume-on-insert.
13. `20260924061300_stamp_completed_by` — completion attribution.
14. `20260924063412_create_list_item_rpc` — atomic list creation.
15. `20260924063500_privatize_legacy_bucket` — privatizes `notes` once empty.
16. `20260924070000_user_cleanup_set_null` — owner/author/audit user links
    become `ON DELETE SET NULL` (nullable) so deleting an account only clears
    attribution; memberships still cascade (PK), board content still cascades
    off deleted boards.
17. `20260924070100_close_public_reads` — profiles visible to self +
    co-members only; legacy `notes` bucket privatised with member-scoped
    read / own-folder member upload / own-folder delete.
18. `20260924070200_lock_actor_stamps` — `completed_by` / `checked_by` /
    `uploaded_by` / `deleted_by` stamped-or-pinned server-side, closing
    attribution forgery (including `checked_by` on insert and
    `uploaded_by` on update).

## Legacy → v2 field mapping (what the backfill did)

- kind `note/photo/list/appointment/grocery` → type `note/photo/list/date(/list)`; bare multi-line texts → titled lists; unparseable `list` rows kept as title-only lists.
- `text` → `body` (lists: title only; items split to rows with positions + checked flags).
- `data.eventAt` (appointments) → `event_at`; `color/rotation` → `paper`; `position_x/y` + `data.manual` → `layout`; `image_url` → `item_assets.storage_path`.
- `completed_at`/`expires_at` carried over; everything starts at `version: 1`.
