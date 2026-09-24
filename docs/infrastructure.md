# Infrastructure

## Local development

Everything runs locally via Docker + the Supabase CLI. This stack is
namespaced `notice` and shifted off the default ports so it can coexist with
other local projects.

| Service | This app |
|---|---|
| API (Kong) | **55321** |
| Postgres | **55322** |
| Studio | **55323** |
| Mailpit | 55324 |
| Analytics | 55327 |

Relevant files: `supabase/config.toml`, `supabase/migrations/`, `.env`
(gitignored, from `.env.example`).

### Everyday commands (repo root)

```bash
supabase start          # start the notice stack
supabase stop           # stop it
supabase status         # URLs + keys
supabase db reset       # wipe + replay all migrations (dev only!)
supabase test db        # pgTAP suites in supabase/tests/
supabase db lint --level warning
supabase functions serve   # run Edge Functions locally
```

### App wiring

`.env` (create from `.env.example`):

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key from `supabase status`>
EXPO_PUBLIC_INVITE_BASE_URL=            # optional locally
EXPO_PUBLIC_TURNSTILE_SITE_KEY=         # empty locally => captcha off
```

- Restart `npx expo start -c` after env changes (values are baked in).
- Simulators reach `127.0.0.1`; physical phones need the Mac's LAN IP.
- Without the Supabase vars the app throws at startup (there is no local
  demo backend anymore).

### Invite Vault secret

The invite functions encrypt links under a Vault secret named `invite`.
`supabase/seed.sql` generates a fresh random key on every `supabase db reset`,
so invites work locally with no manual step. Production sets its own key via
the Vault/dashboard (`db push` does not run seeds).

### Edge Functions

- `delete-account` — called by the app after `delete_account()`; removes the
  auth user via the admin API. `verify_jwt = true`.
- `purge` — nightly (via pg_cron/pg_net); hard-deletes items removed >30 days
  ago and sweeps orphan photo files. Service-role only.
- `cleanup-users` — nightly; deletes idle anonymous users with no boards.

Test locally with `supabase functions serve --env-file supabase/.env.local`
(needs `SUPABASE_SERVICE_ROLE_KEY`).

## Production (hosted Supabase)

1. Create two projects: `notice-dev` and `notice-prod`.
2. Delete `[api] auto_expose_new_tables` default assumption — the migration
   sets it false in `config.toml`; confirm the hosted API exposes only granted
   objects.
3. Apply `supabase/migrations/` in filename order (`supabase db push`).
4. Auth → enable **anonymous sign-ins** and **manual linking**; add
   `noticeboard://auth` (and, if used, the web origin) to **Redirect URLs**.
   `config.toml` only covers the local stack, so this must be set per hosted
   project for identity linking to complete.
5. Set the Vault secret `invite` (Dashboard → Vault, or SQL).
6. Deploy Edge Functions: `supabase functions deploy purge cleanup-users
   delete-account`.
7. Give the nightly jobs their endpoint + key via **Vault** (not a setting):

   ```sql
   select vault.create_secret('https://<ref>.functions.supabase.co', 'functions_url');
   select vault.create_secret('<service role key>', 'service_role_key');
   ```

   The jobs are always scheduled; they become active once these secrets exist.

8. Enable CAPTCHA (Turnstile) and set `EXPO_PUBLIC_TURNSTILE_SITE_KEY` in the
   build env; `[auth.captcha]` is off locally, on in production.
9. Point the release build at the hosted URL/anon key and
   `EXPO_PUBLIC_INVITE_BASE_URL` (see `web/README.md` for the link site).
10. Before launch: turn on point-in-time recovery, review the security and
    performance advisors, and set anonymous-sign-in rate limits.

## Tests & CI

- **Unit** (`node scripts/run-unit-tests.cjs`) — compiles the pure modules
  (`src/utils/*`) and runs `node:test` suites in `scripts/unit` (layout,
  note helpers).
- **DB** (`supabase test db`) — pgTAP suites in `supabase/tests/`:
  `01_tables_rls`, `02_boards`, `03_items`, `04_entries`, `05_invites`,
  `06_storage`, `07_accounts`, `08_jobs`, `09_position`, `10_privileges`,
  `11_authz`, `12_expiry`.
- **CI** (`.github/workflows/ci.yml`): job `check` = `npm ci
  --legacy-peer-deps` → `tsc --noEmit` → `expo lint` → unit tests; job
  `database` = `supabase/setup-cli` → `supabase start` → `db reset` →
  `test db` → `db lint`.
- **Deploy** (`.github/workflows/deploy.yml`, manual `workflow_dispatch`):
  links a hosted project and runs `supabase db push`. Pick the environment
  (`notice-dev`/`notice-prod`); each has its own `SUPABASE_PROJECT_REF` and
  `SUPABASE_DB_PASSWORD` (plus a shared `SUPABASE_ACCESS_TOKEN`). Migrations
  reach production only through this workflow.

## Secrets

Never in the repo: service-role key, Turnstile secret, Supabase access token.
They live in GitHub secrets, Supabase Vault, or Edge Function secrets.
`.env.example` lists only public values.
