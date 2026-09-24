# Infrastructure

## Local development (default)

Everything runs on this machine via Docker + the Supabase CLI. A second
project (`*_Bible_Compass`) already lives here, so this stack is namespaced
`notice` and shifted off the default ports.

| Service | This app | Other app |
|---|---|---|
| API (Kong) | **55321** | 54321 |
| Postgres | **55322** | 54322 |
| Studio | **55323** | 54323 |
| Mailpit | 55324 | 54324 |
| Analytics | 55327 | 54327 |

Relevant files: `supabase/config.toml` (ports above, anonymous sign-ins on),
`supabase/migrations/` (the only schema entry point), `.env` (gitignored).

### Everyday commands (run in the repo root)

```bash
supabase start          # start the notice stack
supabase stop           # stop only this stack
supabase status         # URLs + keys
supabase db reset       # wipe notice DB, replay all migrations (dev only!)
```

`stop`/`reset` touch only `supabase_*_notice` containers — the other project
is never affected (verified repeatedly).

### App wiring

`.env` (create from `.env.example` + `supabase status` output):

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key from status>
```

- Restart `npx expo start` (use `-c` after env changes) — values are baked in
  at bundle time.
- Simulators reach `127.0.0.1` fine. **Physical phones need the Mac's LAN IP**
  (`ipconfig getifaddr en0`), e.g. `http://192.168.1.110:55321` — same
  address works for simulators too. Re-check it when Wi-Fi/DHCP changes.
- Without these vars the app runs the on-device demo backend instead.
- Studio: http://127.0.0.1:55323 · direct psql:
  `psql "postgresql://postgres:postgres@127.0.0.1:55322/postgres"`.

### Production (hosted Supabase)

1. Create a project; note its URL + anon key.
2. Apply `supabase/migrations/` **in filename order**. The initial schema,
   FK fix, hardening, new-model tables + backfill, invites, events/triggers,
   bucket, privacy, invite hardening, and list RPC must all land. (The legacy
   backfill auto-runs inside its migration; it no-ops on empty DBs.)
3. Dashboard → Authentication → enable **anonymous sign-ins** (the app's only
   auth; mirrors `enable_anonymous_sign_ins = true` locally).
4. Point the release build's env at the hosted URL/key.
5. Legacy data, if any: run `scripts/migrate-legacy-photos.cjs` **before**
   relying on the privatised bucket (moves `notes`-bucket files into
   `board-media`, rewrites `item_assets`, drops the old objects; `--delete-bucket`
   removes the bucket once empty).

## Tests & CI

- **Unit** (`node scripts/run-unit-tests.cjs`, no device/backend needed):
  compiles the pure modules and runs `node:test` suites in `scripts/unit`
  (adapter mapping, layout modes/minimums, manual placement + settle).
- **DB integration** (`scripts/db-integration.cjs`): needs `SUPABASE_URL` +
  `SUPABASE_ANON_KEY` pointing at a throwaway stack (it creates and
  soft-deletes a test board). Covers auth, board/member privacy, invites
  (issue/accept/uses/expiry/revoke), items/entries CRUD, toggles, version
  conflicts, soft delete/restore, expiry filtering, events, settings.
- **CI** (`.github/workflows/ci.yml`, on push/PR): `npm ci
  --legacy-peer-deps` → `tsc --noEmit` → `expo lint` → unit tests. The
  `--legacy-peer-deps` flag matches how the lockfile was built (React 19
  peer ranges); DB tests stay local-only since they need a live stack.

## One-off scripts

- `scripts/migrate-legacy-photos.cjs` — see Production §5. Needs
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
