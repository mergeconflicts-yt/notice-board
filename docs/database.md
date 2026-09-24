# Database

Postgres via Supabase. Schema is defined by ordered migrations in
`supabase/migrations/` — never edit an applied migration; add a new one.
Everything lives in `public`.

Structure (docs/plan.md): **clients never write tables**. All mutations go
through `SECURITY DEFINER` functions; reads use tables/views under RLS.
`[api] auto_expose_new_tables = false`, so grants are explicit.

## Enums

- `member_role`: `owner`, `member`
- `item_type`: `note`, `list`, `date`, `photo`
- `item_color`: `butter`, `blush`, `sage`, `sky`, `lavender`, `peach`, `paper`

## Tables

### `profiles`
`id uuid PK → auth.users ON DELETE CASCADE`, `display_name` (1–40 chars),
`avatar_path`, `created_at`, `updated_at`. A row is inserted automatically by
`on_auth_user_created` (default name `Someone`).

### `boards`
`id`, `name` (1–60), `color` (`sage|blue|clay|cream|charcoal`), `timezone`,
`created_by → profiles ON DELETE SET NULL`, `created_at/updated_at`,
`deleted_at` (soft delete).

### `board_members`
PK (`board_id`, `user_id`). `role`, `joined_at`. `board_id → boards CASCADE`,
`user_id → profiles CASCADE`. Only the RPCs create rows.

### `items`
`id uuid PK` (**client-generated** — safe retries), `board_id`, `type`,
`color`, `body`, `title`, `event_at`, `place`, `photo_path`, `pinned`,
`keep_until`, `done_at`, `done_by`, `layout jsonb` (`NULL` = auto-placed, else
`{x, y, manual: true}` — x a fraction of board width, y in layout ref points),
`created_by` / `updated_by` / `deleted_by`
(all `→ profiles ON DELETE SET NULL`), `deleted_at`, `version`, timestamps.
`unique (id, board_id)` is the target of `list_entries`' composite FK.
Checks: date needs `event_at`, photo needs `photo_path`, note needs a body.

### `list_entries`
`id uuid PK` (client-generated), `item_id` + `board_id` with a **composite FK**
to `items (id, board_id)` (an entry can never point at another board),
`text` (1–200), `position double precision`, `checked_at/checked_by`,
`created_by`, timestamps.

### `invites`
`id`, `board_id`, `token_hash bytea UNIQUE`, `code_hash bytea UNIQUE`,
`secret_enc bytea` (token+code encrypted under Vault secret `invite`),
`created_by`, `created_at`, `expires_at` (default +7 days), `revoked_at`.
Partial unique index `invites_one_active_idx` = one active invite per board.

### `rate_limits`
`(user_id, action, window_start, count)` PK. `hit_rate_limit` upserts the
current window; the hourly job deletes windows older than 2 hours.

## Lifetime (`keep_until`)

`public.default_keep_until(type, event_at, pinned, now)` is the single source:

| Case | `keep_until` |
|---|---|
| pinned | `NULL` (stays) |
| note | `now() + 7 days` |
| photo | `now() + 14 days` |
| date | start of the day after `event_at` |
| list | `NULL` until all entries checked, then `now() + 2 days` |
| done (note/date) | `done_at + 2 days` |

## RLS and grants

RLS is enabled on every table. `authenticated` gets **SELECT only** on
`profiles`, `boards`, `board_members`, `items`, `list_entries`, plus the
`visible_items` view. No table has insert/update/delete policies. `invites`
and `rate_limits` have no grants at all.

| Table | Policy | Effect |
|---|---|---|
| `boards` | `is_member(id)` | members only |
| `board_members` | `is_member(board_id)` | members of that board only |
| `items` | `is_member(board_id)` | members only |
| `list_entries` | `is_member(board_id)` | members only |
| `profiles` | self or shares a board | attribution without a user directory |

`public.is_member(board)` is `SECURITY DEFINER` and ignores soft-deleted
boards, so policies never recurse. `visible_items` (`security_invoker`) is the
board view: `deleted_at is null and (keep_until is null or keep_until > now())`.

## Storage

| Bucket | Visibility | Access |
|---|---|---|
| `board-photos` | private | path `<board_id>/<item_id>/<uuid>.jpg`; read = board member; insert = board member **and** `owner = auth.uid()`; no update/delete |
| `avatars` | private | path `<user_id>/<uuid>.jpg`; read = self or someone sharing a board; write = self |

Photo bytes are resized/re-encoded client-side (stripping EXIF) before upload.
Display uses 1h signed URLs.

## Functions

All `SECURITY DEFINER`, empty `search_path`, schema-qualified. Every API
function guards `auth.uid()`, checks membership/role, stamps actor fields from
`auth.uid()` (never parameters), and raises a stable code as the exception
message. See `docs/api.md` for signatures.

Internal (no grants): `hit_rate_limit`, `promote_longest_member`,
`run_list_lifetime`, `expire_items`, `cleanup_rate_limits`, `run_edge_job`,
`invite_key`, `pick_invite_code`, `normalise_invite_code`,
`default_keep_until`. `is_member`/`_path_board_id` are granted to
`authenticated` only (RLS/storage policies run as the caller).

## Triggers

- `touch_updated_at` on profiles/boards/items/list_entries.
- `on_auth_user_created` → insert a `profiles` row.

## Scheduled jobs (`pg_cron` + `pg_net`)

| Job | Schedule | Does |
|---|---|---|
| `expire-items` | every 15 min | `expire_items()` — soft-delete lapsed `keep_until` |
| `cleanup-rate-limits` | hourly | `cleanup_rate_limits()` — drop stale `rl_*` sequences |
| `purge-nightly` | 03:00 | `run_edge_job('/purge')` — Edge Function purge |
| `cleanup-users-nightly` | 03:30 | `run_edge_job('/cleanup-users')` — Edge Function cleanup-users |

The Edge-Function jobs read the functions base URL and service-role key from
Vault (`functions_url`, `service_role_key`) at run time; if absent the job is a
no-op. Nothing sensitive lives in a session setting.

## Migrations

1. `..._init` — enums, tables, indexes, triggers, RLS, grants, view, realtime, buckets, `default_keep_until`.
2. `..._functions_core` — rate limit, profile, boards, items, entries.
3. `..._functions_invites` — invite functions.
4. `..._storage_policies` — board-photos/avatars policies.
5. `..._accounts` — `delete_account`.
6. `..._jobs` — extensions, `expire_items`, `cleanup_rate_limits`,
   `run_edge_job`, schedules.
7. `..._item_position` — `items.layout` + `set_item_position`.
8. `..._boards_realtime` — adds `boards` to the realtime publication.
9. `..._lock_helpers` — revokes client EXECUTE on internal helpers, drops
   `_shares_board_with` (inlined into the avatars policy).
