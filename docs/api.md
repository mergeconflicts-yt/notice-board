# API

Two backends behind one app. `getBackend()` (v1, `src/services/`) is the
legacy contract still used for auth bootstrap and the local demo; `getBackendV2()`
(`src/services/backendV2.ts`, implemented by `supabaseV2.ts`, with an in-memory
`localV2.ts` fallback) is what every screen uses. Types live in `src/types/`.

## Write boundary

Clients never send actor fields (`created_by`, `updated_by`, `checked_by`,
…), timestamps, or versions. Database triggers stamp them from `auth.uid()`.
The only version a client sends is `expectedVersion`, purely as an
optimistic-concurrency guard — a mismatch throws `VersionConflictError`
(`{ entity, id }`), which callers should surface as "changed while you were
editing".

## Boards & members

- `getBoard(id)` → `BoardDetails | null` (soft-deleted boards read as missing).
- `getBoards()` → member boards, newest-joined first, excluding deleted.
- `createBoard(name)` → board + founder-owner membership, atomically (RPC).
- `updateBoard(id, { name?, settings? }, expectedVersion?)`.
- `deleteBoard(id)` → soft delete; `restoreBoard(id)` reverses it.
- `leaveBoard(id)` → removes own membership. UI hides Leave for sole owners.
- `getMembers(boardId)` → memberships with `role` + joined user, oldest first.
- Realtime: `onBoardChanged(boardId, cb)`, `onMembersChanged(boardId, cb)`.

## Invites

- `createInvite(boardId, { maxUses?, expiresAt? })` → `{ invite, token }`.
  The raw `XXXX-XXXX` token is returned **once**; only its hash is stored.
- `acceptInvite(token)` → joined `boardId`. Normalises case/dashes. Errors:
  `this invite is not valid` (unknown/revoked/expired),
  `this invite has already been fully used`. Re-accepts are idempotent and
  free; concurrent accepts serialise on a row lock.
- `revokeInvite(inviteId)`, `getInvites(boardId)` (no token hashes — list rows
  never expose them).

## Items (notes)

- `getItems(boardId)` → live, non-expired items with authors, oldest first.
- `addItem({ boardId, type, body?, eventAt?, expiresAt?, paper?, layout? })`.
  Photo bodies are captions; bytes travel separately (below).
- `updateItem(id, patch, expectedVersion?)` — partial; only defined keys are
  sent. `deletedAt` set/cleared drives soft-delete/restore (server stamps
  `deleted_by`); `completedAt` set/cleared drives completion (`completed_by`).
- `deleteItem(id)` / `restoreItem(id)` — thin wrappers over the above.
- Realtime: `onItemsChanged(boardId, cb)`.

`paper` defaults to `{ color: 'yellow', rotation: 0 }`; `layout` is
`{ x, y, manual }` or null (= auto layout). Type enum is
`note | photo | list | date` (`date` renders as the app's "appointment").

## Entries (checklist rows)

- `getEntries(boardId)` → live rows ordered by item then position.
- `addEntry({ boardId, itemId, text, position? })` — position defaults to
  append. For whole lists prefer `addListItem` (below).
- `updateEntry(id, { text?, position?, isChecked? }, expectedVersion?)` —
  toggling stamps `checked_by/at` server-side. `deleteEntry`/`restoreEntry`
  wrap `deletedAt` like items.
- Realtime: `onEntriesChanged(boardId, cb)`.
- `addListItem({ boardId, body?, paper?, layout?, expiresAt?, entries: [{ text, position?, done? }] })`
  creates an item **plus all entries in one RPC**; returns the item id.

## Assets (photos)

- `uploadAsset(boardId, itemId, localUri, mime?)` — reads the file to an
  `ArrayBuffer` (`expo-file-system`), uploads to
  `board-media/board/<board>/item/<item>/<file>`, records the row (mime +
  byte count). If the row insert fails, uploaded bytes are removed again.
- `getAssets(boardId)`, `deleteAsset(id)` (row + bytes).
- `getAssetUrl(asset, expiresInSec = 3600)` — time-boxed signed URL. The
  bucket is private; **never** persist or share these URLs, re-mint on load
  and refresh before expiry (the board hooks do this on a 50-minute cycle).
- Realtime: `onAssetsChanged(boardId, cb)`.

## Events & settings

- `getEvents(boardId, limit = 50)` — newest-first audit trail
  (`insert`/`update`/`delete`/`restore` with before/after snapshots).
- `getSettings()` → `null` until first save; `updateSettings(patch)` merges.

## Direct RPCs (also callable raw)

| Function | Returns |
|---|---|
| `create_board(p_name)` | board row |
| `create_board_invite(p_board_id, p_max_uses?, p_expires_at?)` | `{ invite_id, token }[]` |
| `accept_board_invite(p_token)` | `board_id uuid` |
| `revoke_board_invite(p_invite_id)` | void |
| `create_list_item(p_board_id, p_body?, p_paper?, p_layout?, p_expires_at?, p_entries?)` | item id |

## Legacy v1 contract (frozen)

`getBackend()` with `getBoard(s)`, `createBoard`, `joinBoard(code)`,
`getNotes/addNote/updateNote/deleteNote`, members, and image upload to the
public `notes` bucket. Still used for auth bootstrap (`init`, `ensureUser`)
and as the local-demo fallback; no new features go here.
