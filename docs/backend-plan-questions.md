# Backend plan questions and deviations

Log for anything in `docs/plan.md` that is impossible, unclear, or was
implemented slightly differently. Appended as work proceeds.

1. **Missing object `b4022b9`.** No commit or stash entry with that hash
   exists in this repo. Every stash's `AGENTS.md` is byte-identical to the
   working tree's `AGENTS.md`, so the referenced product spec is available
   and was read. Proceeding.
2. **Note body check.** The plan's `type != 'note' or
   char_length(btrim(body)) > 0` passes when `body` is `NULL` (CHECK treats
   NULL as pass), which would allow empty notes. Implemented as
   `char_length(btrim(coalesce(body, ''))) > 0` to enforce the evident
   intent.
3. **Date lifetime timezone.** `default_keep_until(type, event_at, pinned,
   now)` takes no timezone, so the "day after `event_at`" boundary is
   computed with `date_trunc` (UTC on Supabase). `boards.timezone` is
   stored as planned; threading it into the function signature can happen
   when per-board timezones are actually needed.
4. **Storage policies deferred.** Buckets (`board-photos`, `avatars`) are
   created in the init migration, but the `storage.objects` policies from
   plan section 7 land with phase 3 (photos), alongside their tests.
5. **Rate counting uses sequences, not `rate_limits`.** A table row written
   by a throttled call rolls back with that call, so failures (the exact
   thing `invite_try` must count) would never accumulate. `hit_rate_limit`
   counts with per-user/action/window sequences (`nextval` survives
   rollback). The `rate_limits` table stays defined but unused; phase 6
   should either drop it or use it for audit, and the hourly cleanup job
   must drop stale `rl_*` sequences instead of/in addition to old rows.
6. **Invalid invites return empty/NULL, not `invite_invalid`.** The plan
   says to raise the same `invite_invalid` for every failure. Raising aborts
   the call, which rolls back the `hit_rate_limit` attempt — so wrong guesses
   would never count toward the 10/hour brute-force cap. `preview_invite`
   therefore returns zero rows and `accept_invite` returns NULL for valid-
   but-unusable tokens (wrong/expired/revoked/deleted board); the app maps
   that to one generic "That invite isn't working" message, which is the same
   UX the shared error code gave. Errors (`not_authenticated`, `rate_limited`)
   still raise.
7. **Local dev needs the Vault `invite` secret.** The invite functions read
   `vault.decrypted_secrets` for the key. Tests create it inside their
   transaction (so it rolls back), and production sets it via the dashboard,
   but `supabase db reset` leaves a local stack without it — invite calls
   then fail with "invite service not configured". Local developers must run
   `select vault.create_secret('<any dev key>', 'invite');` once after a
   reset (documented in infrastructure docs, phase 6). A seed file was not
   used because the pgTAP tests also create an `invite` secret and would hit
   the unique-name constraint.
8. **Phase 2 data layer: `getBoardContent` reads the `items` table, not the
   `visible_items` view.** The board needs author profiles embedded, which
   the view (no FK, invoker rights) can't expose; the same deleted/expired
   filter is applied in the query instead. `visible_items` remains for
   future use and is tested.
9. **Superseded: drag persistence is back.** Plan §9 removed hand-placed
   positions ("positions are computed from item ids on the client"). At the
   owner's request that is reversed: `items.layout jsonb`
   (`{x, y, manual}`) plus `set_item_position`, and the board drag gesture
   persists the drop point. New items stay auto-placed until dragged;
   passing NULL clears back to auto.
