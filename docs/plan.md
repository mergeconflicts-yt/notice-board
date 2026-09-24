# Backend plan: database, API, security

Implementation plan for the Notice Board backend (Supabase + Expo). Written for the agent doing the work.

## 0. Ground rules for the implementing agent

- **Do not `git commit` or `git push`.** Leave all changes uncommitted for the owner to review.
- Read the product spec before starting: `git show b4022b9:AGENTS.md`. It is kept in a git stash, not in the current `AGENTS.md`. Do not change product behaviour beyond what this plan says.
- This is a new project with no real data. **Replace** the existing schema; do not write compatibility migrations.
- Work phase by phase (section 12). Each phase ends with its checks passing.
- If something in this plan is impossible or clearly wrong, stop and write the problem in `docs/backend-plan-questions.md` instead of guessing.

## 1. Decisions already made

| Topic | Decision |
| --- | --- |
| Sign-in | Anonymous Supabase auth at first launch. Optional linking later (Apple, Google, email link) keeps the same user id. |
| Local demo mode | Remove it. Development uses a local Supabase stack (`supabase start`). |
| Writes | The client never writes tables directly. All writes go through Postgres functions (RPC). Reads use tables/views with row-level security (RLS). |
| Roles | `owner` and `member` only. |
| Editing text | Only the author can edit an item's text, title, date, place or caption. |
| Everything else on items | Any member can pin, unpin, mark done, undo done, keep longer, remove, restore. |
| List entries | Any member can add, tick, untick, edit, remove entries. |
| Deleted account | Their posts stay. Author shows as "Former member" (`created_by` becomes `NULL`). |
| Default lifetime | Note 7 days, photo 14 days, date until the day after the event, list until 2 days after all entries are checked, done items 2 days after done. |
| Invite links | One active link per board, valid 7 days. Base URL comes from config because there is no domain yet. |
| Removed items | Soft delete. Restorable for 30 days, then purged. |

## 2. Clean-up before building

1. Delete everything in `supabase/migrations/`.
2. Delete `scripts/migrate-legacy-photos.cjs` and `scripts/db-integration.cjs` (replaced by pgTAP tests).
3. Delete the V1 and local services: `src/services/backend.ts`, `src/services/local.ts`, `src/services/localV2.ts`, `src/services/supabase.ts`. Keep `supabaseV2.ts` only as reference, then replace it (section 9).
4. In `supabase/config.toml`:
   - set `[api] auto_expose_new_tables = false` (explicit grants only);
   - remove the `seed.sql` reference or add `supabase/seed.sql` with a small demo board;
   - `[auth] enable_anonymous_sign_ins = true`, `enable_manual_linking = true`;
   - enable CAPTCHA for auth (`[auth.captcha]`, provider `turnstile`) with the secret coming from env. Keep it off locally, on in production.
5. Delete `docs/api.md`, `docs/database.md`, `docs/infrastructure.md`. Rewrite them at the end (phase 6).

## 3. Schema

Create in one migration: `supabase/migrations/<timestamp>_init.sql`. All tables in `public`. Use `uuid` ids with `gen_random_uuid()` defaults, and `timestamptz` everywhere.

### Enums

```sql
create type member_role as enum ('owner', 'member');
create type item_type as enum ('note', 'list', 'date', 'photo');
create type item_color as enum ('butter', 'blush', 'sage', 'sky', 'lavender', 'peach', 'paper');
```

### Tables

**profiles**

- `id uuid primary key references auth.users(id) on delete cascade`
- `display_name text not null check (char_length(btrim(display_name)) between 1 and 40)`
- `avatar_path text` (nullable)
- `created_at`, `updated_at`

**boards**

- `id`, `name text not null check (char_length(btrim(name)) between 1 and 60)`
- `color text not null default 'sage' check (color in ('sage', 'blue', 'clay', 'cream', 'charcoal'))`
- `created_by uuid references profiles(id) on delete set null`
- `created_at`, `updated_at`, `deleted_at` (nullable)

**board_members**

- `board_id uuid references boards(id) on delete cascade`
- `user_id uuid references profiles(id) on delete cascade`
- `role member_role not null default 'member'`
- `joined_at`
- `primary key (board_id, user_id)`

**items**

- `id uuid primary key` (no default: the client generates it; see idempotency in section 5)
- `board_id uuid not null references boards(id) on delete cascade`
- `type item_type not null`
- `color item_color not null default 'butter'`
- `body text check (char_length(body) <= 2000)`: note text or photo caption
- `title text check (char_length(title) <= 120)`: list or date title
- `event_at timestamptz`: dates only, required when `type = 'date'`
- `place text check (char_length(place) <= 120)`
- `photo_path text`: required when `type = 'photo'`
- `pinned boolean not null default false`
- `keep_until timestamptz` (`NULL` means it stays)
- `done_at timestamptz`, `done_by uuid references profiles(id) on delete set null`
- `created_by uuid references profiles(id) on delete set null`
- `updated_by uuid references profiles(id) on delete set null`
- `deleted_at timestamptz`, `deleted_by uuid references profiles(id) on delete set null`
- `version int not null default 1`
- `created_at`, `updated_at`
- `unique (id, board_id)` (target for the composite foreign key below)
- checks:
  - `type != 'date' or event_at is not null`
  - `type != 'photo' or photo_path is not null`
  - `type != 'note' or char_length(btrim(body)) > 0`

**list_entries**

- `id uuid primary key` (client-generated)
- `item_id uuid not null`, `board_id uuid not null`
- `foreign key (item_id, board_id) references items(id, board_id) on delete cascade`
  - This makes it impossible for an entry to point at another board.
- `text text not null check (char_length(btrim(text)) between 1 and 200)`
- `position double precision not null`
- `checked_at timestamptz`, `checked_by uuid references profiles(id) on delete set null`
- `created_by uuid references profiles(id) on delete set null`
- `created_at`, `updated_at`

**invites**

- `id`, `board_id uuid not null references boards(id) on delete cascade`
- `token_hash bytea not null unique`: SHA-256 of the link token; `code_hash bytea not null unique`: SHA-256 of the short fallback code
- `secret_enc bytea not null`: token and code encrypted with `extensions.pgp_sym_encrypt(token || ':' || code, <key from Supabase Vault secret 'invite'>)`, so members can re-share the same link without rotating it. Hashes are used for lookup; the encrypted copy is only decrypted inside `get_invite_link`.
- `created_by uuid references profiles(id) on delete set null`
- `created_at`, `expires_at timestamptz not null default now() + interval '7 days'`, `revoked_at`
- partial unique index: one active invite per board, `unique (board_id) where revoked_at is null`. Expired rows are replaced by `get_invite_link`.

**rate_limits**

- `user_id uuid`, `action text`, `window_start timestamptz`, `count int`
- `primary key (user_id, action, window_start)`

### Indexes

- `items (board_id, created_at desc) where deleted_at is null`
- `items (keep_until) where deleted_at is null and keep_until is not null`
- `items (deleted_at) where deleted_at is not null`
- `list_entries (item_id, position)`
- `list_entries (board_id)`
- `board_members (user_id)`
- `invites (board_id)`

### Triggers

- `updated_at` touch trigger on every table that has the column.
- `profiles`: create a row automatically on insert into `auth.users` (default display name `'Someone'` until the user sets a name).

## 4. Row-level security and grants

In the init migration, after the tables:

```sql
alter table <every table> enable row level security;
revoke all on all tables in schema public from anon, authenticated;
grant select on profiles, boards, board_members, items, list_entries to authenticated;
-- no grants at all on invites and rate_limits: only functions touch them
```

Membership helper (used by every policy and function):

```sql
create function public.is_member(p_board uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.board_members m
    join public.boards b on b.id = m.board_id
    where m.board_id = p_board and m.user_id = auth.uid() and b.deleted_at is null
  );
$$;
```

Select policies (all to `authenticated`, none for `anon`):

| Table | Policy |
| --- | --- |
| `boards` | `is_member(id)` |
| `board_members` | `is_member(board_id)` |
| `items` | `is_member(board_id)` |
| `list_entries` | `is_member(board_id)` |
| `profiles` | `id = auth.uid()` or the user shares a board with you (`exists` join on `board_members` twice) |

View for the board screen (`security_invoker = true`, so RLS still applies):

```sql
create view public.visible_items with (security_invoker = true) as
select * from public.items
where deleted_at is null and (keep_until is null or keep_until > now());
```

Realtime: add only `items`, `list_entries`, `board_members` to the `supabase_realtime` publication. Never `profiles`, `invites` or `rate_limits`.

## 5. API (Postgres functions)

Rules for **every** function:

- `security definer`, `set search_path = ''`.
- Every table name written as `public.<table>`.
- First line: `if auth.uid() is null then raise exception 'not_authenticated'; end if;`
- Check membership (`public.is_member`) or role before doing anything.
- Set `created_by`, `updated_by`, `done_by`, `checked_by`, `deleted_by` from `auth.uid()`. Never take them as parameters.
- Raise errors with stable codes the app can map: `not_authenticated`, `not_member`, `not_owner`, `not_author`, `not_found`, `invalid_input`, `version_conflict`, `rate_limited`, `invite_invalid`.
- After creating: `revoke execute on function ... from public, anon; grant execute ... to authenticated;`
- Bump `version` and `updated_at` on every item change.

### Profile and account

| Function | Does |
| --- | --- |
| `update_profile(display_name text, avatar_path text default null)` | Updates own profile. |
| `delete_account()` | Deletes boards where the caller is the only member. Transfers ownership of the caller's other boards to the longest-standing member where the caller is the last owner. Removes the caller's memberships and profile avatar. Then an Edge Function deletes the auth user (functions cannot delete `auth.users` safely). Posts stay with `created_by = NULL`. |

### Boards

| Function | Access | Does |
| --- | --- | --- |
| `create_board(name text, color text) → boards` | any user | Inserts board and an owner membership. Rate limit: 10 per hour. |
| `rename_board(board_id, name, color)` | owner | Updates. |
| `delete_board(board_id)` | owner | Sets `deleted_at`; revokes its invite. |
| `leave_board(board_id)` | member | Removes membership. If the caller was the last owner, promotes the longest-standing member. If nobody is left, soft-deletes the board. |
| `remove_member(board_id, user_id)` | owner | Removes a member. Cannot remove yourself (use `leave_board`). |

### Invites

Tokens: link token = 16 random bytes (`extensions.gen_random_bytes(16)`), base64url, about 22 characters. Fallback code = 10 characters from the 32-character alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no I, O, 0, 1), about 50 bits. Pick each character as `byte % 32` from `gen_random_bytes` (not `random()`); 256 is a multiple of 32, so there is no bias. Shown as `XXXXX-XXXXX`; strip dashes and uppercase before hashing. Store only SHA-256 hashes.

| Function | Access | Does |
| --- | --- | --- |
| `get_invite_link(board_id) → {token, code, expires_at}` | member | If an active, unexpired invite exists, decrypt and return it (same link for every member). Otherwise revoke any expired one and create a new one. Rate limit: 30 per hour. |
| `reset_invite_link(board_id)` | owner | Revokes the active invite. |
| `preview_invite(token_or_code text) → {board_name, invited_by, member_first_names, member_count}` | any user | No board content. Counts toward the `invite_try` rate limit. |
| `accept_invite(token_or_code text, display_name text) → board_id` | any user | Rate limit `invite_try`: 10 per hour per user. Locks the invite row (`for update`). Checks it is not revoked or expired and the board is not deleted. Adds a membership (no error if already a member) and sets `display_name` if given. Same `invite_invalid` error for every failure reason. |

### Items

| Function | Access | Does |
| --- | --- | --- |
| `post_item(id uuid, board_id uuid, type item_type, color item_color, body text, title text, event_at timestamptz, place text, photo_path text, pinned boolean, entries jsonb) → items` | member | Idempotent: `insert ... on conflict (id) do nothing`, then return the row. For lists, inserts `entries` (array of `{id, text}`) in the same transaction. Sets `keep_until` from section 6. Validates that `photo_path` starts with `<board_id>/<id>/`. Rate limit: 300 per hour. |
| `edit_item(id, expected_version int, body, title, event_at, place, color)` | author only (`created_by = auth.uid()`) | Raises `version_conflict` if the version does not match. Recomputes `keep_until` for dates. |
| `set_pinned(id, pinned boolean)` | member | Pinned means `keep_until = NULL`. Unpinning sets the type default from now. |
| `set_done(id, done boolean)` | member | Notes and dates only. Done sets `done_at`, `done_by`, `keep_until = now() + 2 days`. Undo clears them and restores the type default. |
| `keep_longer(id)` | member | `keep_until = greatest(keep_until, now()) + 7 days`. Not for pinned items or lists. |
| `remove_item(id)` | member | Soft delete: `deleted_at`, `deleted_by`. |
| `restore_item(id)` | member | Only if deleted within 30 days. Clears `deleted_at`. If `keep_until` has passed, sets it to `now() + 2 days`. |
| `list_removed_items(board_id) → setof items` | member | Soft-deleted in the last 30 days, for the board settings screen. |

### List entries

| Function | Access | Does |
| --- | --- | --- |
| `add_entry(id uuid, item_id uuid, text)` | member | Idempotent. `position = max + 1` under `select ... for update` of the parent item row (prevents duplicate positions). |
| `set_entry_checked(id, checked boolean)` | member | Sets or clears `checked_at` and `checked_by`, then runs the list lifetime rule. |
| `edit_entry(id, text)` | member | Edits entry text. |
| `remove_entry(id)` | member | Hard delete (entries are small; the list itself is soft-deleted). Runs the list lifetime rule. |

List lifetime rule (inside those functions): if the list has entries and all are checked, `keep_until = now() + 2 days`. Otherwise `keep_until = NULL` (unless the list was removed).

### Reads (direct queries from the app)

- My boards: `boards` joined with `board_members`, where `deleted_at is null`.
- Board content: `visible_items where board_id = $1`, plus `list_entries where board_id = $1`, plus member profiles.
- Delta after reconnect: same queries with `updated_at > $last_seen`. Also re-fetch item ids to catch deletions (soft deletes change `updated_at`, so they appear in the delta; filter them out client-side).

## 6. Lifetime rules (`keep_until`)

Put the rules in one SQL function, `public.default_keep_until(type, event_at, pinned, now)`, used by `post_item`, `set_pinned`, `set_done` and `edit_item`:

| Case | `keep_until` |
| --- | --- |
| pinned | `NULL` |
| note | `now() + 7 days` |
| photo | `now() + 14 days` |
| date | start of the day after `event_at` (in the board's timezone; store `boards.timezone text default 'UTC'`, set by the app from the device on create) |
| list | `NULL` until all entries are checked, then `now() + 2 days` |
| done (note or date) | `done_at + 2 days` |

The app shows these words (the mockup `design-mockups/notice-board-redesign.html` has them: "Leaves the board Thu 1 Oct", "Keep longer"). The app never decides expiry itself; it trusts `keep_until` from the server.

## 7. Photos (Storage)

- Bucket `board-photos`: private, `file_size_limit = 10MB`, `allowed_mime_types = ['image/jpeg', 'image/webp', 'image/heic']`. Create it in the migration.
- Path: `<board_id>/<item_id>/<random uuid>.jpg`.
- Policies on `storage.objects` for this bucket, to `authenticated`:
  - `select`: member of the board in the path;
  - `insert`: same check, **and** `owner = auth.uid()`.
  - no update policy; no delete policy (deletes happen in the purge job with the service role).
- Client before upload: `expo-image-manipulator` resize (longest side 2048) and re-encode as JPEG, quality 0.8. **This strips EXIF, including GPS location.** Never upload the original file.
- Upload order: upload the file, then `post_item` with `photo_path`. If `post_item` fails, the orphan file is removed by the nightly job (files with no matching item older than 24h).
- Display: `createSignedUrl` with 1h expiry; cache by path in memory.
- Avatars: separate private bucket `avatars`, path `<user_id>/<uuid>.jpg`. Readable if you share a board with that user; writable only by the user.

## 8. Auth and sessions (app side)

1. **One** Supabase client for the whole app, in `src/lib/supabase.ts`.
2. Session storage: `expo-secure-store` via the "LargeSecureStore" pattern (AES key in SecureStore, encrypted session in AsyncStorage), because sessions exceed SecureStore's size limit. Add `expo-secure-store` and `aes-js` (or `expo-crypto`).
3. Start-up logic:
   - stored session exists → use it; `autoRefreshToken: true`;
   - no stored session at all → `signInAnonymously({ options: { captchaToken } })`;
   - refresh fails or network errors → **do not** create a new user. Show "Can't reach the board", retry with backoff.
   - Only an explicit "Sign out" clears the session.
4. Account linking (Profile → "Save your account"):
   - Apple / Google: `supabase.auth.linkIdentity({ provider })`
   - Email: `supabase.auth.updateUser({ email })`, then the user confirms via the link.
   - The user id stays the same, so no data moves.
   - On a new phone: normal sign-in with the same provider returns the same user.
   - Prompt (dismissible, never blocking) when the user creates or joins their 2nd board, or 7 days after first launch.
5. CAPTCHA: Cloudflare Turnstile inside a small WebView for anonymous sign-in, production only.

## 9. App data layer

- Generate types: `supabase gen types typescript --local > src/lib/database.types.ts`
- One module `src/lib/api.ts` with typed wrappers for every RPC in section 5 and the reads in section 5. Map error codes to friendly messages.
- Item and entry ids are generated on the client (`expo-crypto randomUUID()`), so retries are safe.
- Optimistic updates: apply locally, call the RPC, and on error roll back and show a toast. Handle `version_conflict` with "Someone just changed this" and reload that item.
- Realtime: one channel per open board, `postgres_changes` on `items` and `list_entries` with filter `board_id=eq.<id>`. Apply each row change in place. **Do not** refetch the whole board on every event. On reconnect, run the delta read.
- Signed photo URLs: fetch once per path, refresh on expiry. Not for every item on every change.
- Update `src/hooks/useBoardV2.ts` (rename to `useBoard.ts`) to use the new module. Remove the layout "manual" / drag-position persistence: positions are computed from item ids on the client.

## 10. Scheduled jobs

Enable the `pg_cron` and `pg_net` extensions in the migration.

| Job | When | How | Does |
| --- | --- | --- | --- |
| expire | every 15 min | `pg_cron`, plain SQL | `update items set deleted_at = now(), deleted_by = null where deleted_at is null and keep_until < now()` |
| purge | nightly | `pg_cron` calls Edge Function `purge` via `pg_net` with the service role key from Vault | Hard-delete items with `deleted_at < now() - 30 days`. Delete their storage objects **with the Storage API** (never delete from `storage.objects`). Delete orphan files older than 24h. |
| cleanup-users | nightly | same Edge Function | Delete anonymous users (`is_anonymous = true`) with no memberships and no sign-in for 30 days, using the admin API. |
| delete-account | on demand | Edge Function `delete-account`, called by the app after `delete_account()` | Deletes the auth user with the admin API. |
| rate-limit cleanup | hourly | `pg_cron` | Delete `rate_limits` rows older than 2 hours. |

Rate-limit helper: `public.hit_rate_limit(action text, max int, window interval)` inserts or increments the row for the current window and raises `rate_limited` when over max.

## 11. Invite links and deep links

- `EXPO_PUBLIC_INVITE_BASE_URL` in env (for example `https://noticeboard-app.vercel.app`). Link format: `<base>/j/<token>`. Never hard-code a domain.
- Until there is a domain: host a tiny static site on a free Vercel or Netlify subdomain with:
  - `.well-known/apple-app-site-association` (applinks for `/j/*`)
  - `.well-known/assetlinks.json`
  - `/j/[token]`: a page with "Open in the app" (tries `noticeboard://join/<token>`) and store links.
- `app.json`: `ios.associatedDomains: ["applinks:<host>"]`, `android.intentFilters` for `https://<host>/j/*` with `autoVerify: true`, and scheme `noticeboard`.
- Expo Router route `src/app/j/[token].tsx`: calls `preview_invite`, shows the join screen, then `accept_invite`.
- Universal links need a development build, not Expo Go.
- The code fallback screen (`join.tsx`) accepts `XXXXX-XXXXX` and uses the same functions.
- Share with the React Native Share API: message `Join "<board>" on Notice Board: <link>`.

## 12. Phases and checks

Run after every phase: `npx tsc --noEmit`, `npx expo lint`, `node scripts/run-unit-tests.cjs`, `supabase db reset`, `supabase test db`, `supabase db lint`

**Phase 1 - Database foundation**

- Clean-up (section 2), schema (3), RLS (4), functions (5), lifetime rules (6).
- pgTAP tests in `supabase/tests/` (see section 13).
- Done when: `supabase db reset` works on an empty stack, all tests pass, `supabase db lint` reports no security issues.

**Phase 2 - App data layer and sessions**

- Sections 8 (steps 1-3) and 9. Remove all old services.
- Done when: create a board, post each item type, tick entries, pin, done, remove and restore all work against local Supabase; two simulators see each other's changes live; killing the network does not create a new user.

**Phase 3 - Photos**

- Section 7.
- Done when: an uploaded photo has no EXIF (check with `exiftool`); a non-member cannot read it (test); a wrong path is rejected.

**Phase 4 - Invites**

- Section 11 and the invite functions.
- Done when: a link opens the join screen in a dev build; expired, revoked and wrong tokens all give the same error; the 11th wrong try in an hour is rate-limited.

**Phase 5 - Accounts**

- Section 8 steps 4-5, `delete_account` and its Edge Function.
- Done when: linking keeps the same user id and boards; deleting an account keeps its posts with "Former member".

**Phase 6 - Jobs, CI, docs**

- Section 10, section 14, and rewrite `docs/api.md`, `docs/database.md`, `docs/infrastructure.md` from the final code.
- Done when: CI runs all checks on a clean runner, and the expire and purge jobs are covered by tests.

## 13. Required pgTAP tests

For every table and function, test as: anon (no JWT), non-member, member, owner.

- Nobody can insert, update or delete any table directly (expect permission denied).
- Non-member sees 0 rows from `boards`, `items`, `list_entries`, `board_members`, and cannot call any board function.
- Profiles are visible only to yourself and people sharing a board with you.
- Attribution: `created_by`, `done_by`, `checked_by` and `deleted_by` always equal the caller, whatever the input.
- `edit_item` by a non-author raises `not_author`; pin, done and remove by a non-author succeed.
- `add_entry` cannot attach to another board's list (composite foreign key).
- `version_conflict` on a stale `expected_version`.
- `post_item` twice with the same id creates one row.
- Lifetime: each row of the section 6 table, including "all entries ticked" and "untick resets".
- `visible_items` hides expired and removed items; `restore_item` brings them back within 30 days only.
- Invites: valid, expired, revoked, deleted board, wrong code, rate limit, already a member, `preview_invite` returns no content.
- `leave_board` as last owner promotes someone; as last member soft-deletes the board. `delete_account`: posts remain with `created_by NULL`; sole-member boards are deleted.
- Deleting a user never deletes a board or another person's items (`on delete set null` checks).
- Storage: member can read and upload in their board folder; non-member cannot; malformed path is denied, not an error.

## 14. CI and environments

- Add a database job to `.github/workflows/ci.yml`: `supabase/setup-cli@v1`, `supabase start`, `supabase db reset`, `supabase test db`, `supabase db lint --level warning`.
- Two Supabase projects: `notice-dev` and `notice-prod`. Migrations reach prod only via `supabase db push` from a manual CI workflow with the access token in GitHub secrets.
- Secrets never in the repo: the service role key, Turnstile secret and Supabase access token live in GitHub secrets, Supabase Vault or Edge Function secrets.
- `.env.example` lists only public values: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_INVITE_BASE_URL`, `EXPO_PUBLIC_TURNSTILE_SITE_KEY`.
- Before launch: turn on point-in-time recovery, review the dashboard security and performance advisors, and set auth rate limits (anonymous sign-ins per IP).

## 15. Out of scope for now

- Push notifications and date reminders (later: local notifications on the device, no server).
- Offline write queue beyond optimistic updates and retry.
- Content moderation or reporting (boards are private and invite-only).
- Web app.
