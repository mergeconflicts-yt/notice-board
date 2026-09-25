# API

Two surfaces (docs/plan.md): **reads** via PostgREST (tables + the
`visible_items` view under RLS), and **writes** via Postgres functions
(`supabase.rpc`). The app wraps both in `src/lib/api.ts`.

## Errors

Functions raise a stable code as the exception message; `src/lib/api.ts`
maps it to friendly copy (`ApiError`, `friendlyMessage`).

| Code | Meaning |
|---|---|
| `not_authenticated` | no session |
| `not_member` | caller is not on the board |
| `not_owner` | owner-only action |
| `not_author` | only the author may edit text/title/date/place |
| `not_found` | missing / removed / deleted-board target |
| `invalid_input` | validation failed |
| `version_conflict` | `expected_version` did not match |
| `rate_limited` | over the per-hour cap |
| `invite_invalid` | invalid/expired/revoked invite |

Invalid invites are deliberately **silent**: `preview_invite` returns zero
rows and `accept_invite` returns `NULL` (so the attempt still counts toward
the brute-force cap). See `docs/backend-plan-questions.md` #6.

Board-scoped actions (`delete_board`, `leave_board`, `remove_member`,
`reset_invite_link`) return `not_member` for a missing, soft-deleted or
foreign board alike, so the error never reveals that a board exists.

Every mutating function shares one `item_write` rate limit (600/hour) on top
of any per-action bucket (`post_item`, `add_entry`, invites).

## Reads (direct, RLS-scoped)

| What | Query |
|---|---|
| My boards | `boards` where `deleted_at is null` |
| Board | `boards` by id |
| Members | `board_members` + embedded `profiles` |
| Board content | `items` where live, + `list_entries` for the board |
| Removed posts | RPC `list_removed_items` |

`src/lib/api.ts`: `getMyBoards`, `getBoard`, `getMembers`,
`getBoardContent(boardId, since?)`, `getRemovedItems`.
`since` powers the reconnect delta (`updated_at > since`).

## Functions

### Profile / account
| Function | Access | Notes |
|---|---|---|
| `update_profile(p_display_name, p_avatar_path?, p_clear_avatar?)` | any user | own row; avatar is kept unless `p_clear_avatar` |
| `delete_account()` | any user | tidies boards; auth user removed by Edge Function |

### Boards
| Function | Access | Notes |
|---|---|---|
| `create_board(p_name, p_color, p_timezone)` | any user | owner membership; `p_timezone` (IANA) drives date expiry; rate limit 10/h |
| `rename_board(p_board_id, p_name, p_color)` | owner | |
| `delete_board(p_board_id)` | owner | soft delete + revoke invite |
| `leave_board(p_board_id)` | member | promotes longest member or soft-deletes empty board |
| `remove_member(p_board_id, p_user_id)` | owner | cannot remove self |

### Invites
| Function | Access | Notes |
|---|---|---|
| `get_invite_link(p_board_id)` → `{token, code, expires_at}` | member | decrypts the shared link, rotating if expired |
| `reset_invite_link(p_board_id)` | owner | revoke active invite |
| `preview_invite(p_token_or_code)` → `{board_name, invited_by, member_first_names, member_count}` | any user | no board content; rate limit 10/h |
| `accept_invite(p_token_or_code, p_display_name?)` → `board_id \| NULL` | any user | idempotent; same limits |

### Items
| Function | Access | Notes |
|---|---|---|
| `post_item(p_id, p_board_id, p_type, p_color, p_body, p_title, p_event_at, p_place, p_photo_path, p_pinned, p_entries)` → item | member | idempotent on `p_id`; validates photo path `<board_id>/<item_id>/…` and that fields match the type (finite `event_at`, dates only); title list/date, place date; rate limit 300/h |
| `edit_item(p_id, p_expected_version, p_body, p_title, p_event_at, p_place, p_color)` | author | `version_conflict` on stale version; same type rules; a date's lifetime is recomputed only when `event_at` changes |
| `set_pinned(p_id, p_pinned)` | member | pinned = `keep_until NULL`; no-op if already in that state |
| `set_done(p_id, p_done)` | member | notes/dates only; first done wins; no-op if already in that state |
| `keep_longer(p_id)` | member | +7 days, capped at 30 days from now; not pinned/lists |
| `set_item_position(p_id, p_x, p_y)` | member | hand-place a note (`items.layout`); NULL clears to auto; does **not** bump `version` or stamp `updated_by` |
| `remove_item(p_id)` / `restore_item(p_id)` | member | soft delete; restore within 30 days |
| `list_removed_items(p_board_id)` | member | last 30 days |

### List entries
| Function | Access | Notes |
|---|---|---|
| `add_entry(p_id, p_item_id, p_text)` | member | idempotent; `position = max+1` |
| `set_entry_checked(p_id, p_checked)` | member | first tick wins; runs list lifetime |
| `edit_entry(p_id, p_text)` | member | |
| `remove_entry(p_id)` | member | hard delete; runs list lifetime |

Ticking/removing an entry locks the parent list first, so two people ticking
the last two entries can't both recompute `keep_until` from stale state.

## Realtime

Publication `supabase_realtime` carries `items`, `list_entries`, and `boards`.
`board_members` is deliberately **not** published: Supabase doesn't apply RLS
to DELETE events, so every subscriber would learn who left any board. The app
opens one channel per board, filtered by `board_id=eq.<id>`, applies row
changes in place, and runs a delta read on reconnect (the member list refreshes
on focus/foreground).
