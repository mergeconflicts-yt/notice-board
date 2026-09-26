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
supabase functions serve   # run Edge Functions locally (separate terminal!)
```

`supabase start` does **not** serve Edge Functions. Guest sign-out and
account deletion call the `delete-account` function, so without
`supabase functions serve` running alongside, both fail with a network error.
Keep both processes up during development.

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
  ago, sweeps orphan photos, and removes avatar files that are no longer a
  user's current avatar. `verify_jwt = false`; it checks a job secret itself.
- `cleanup-users` — nightly; deletes idle anonymous users with no boards.
  Candidate selection + re-check run in SQL (see below). Same job secret.

Both scheduled functions authenticate the request themselves: pg_net sends
`Authorization: Bearer <job secret>` (Vault secret `job_secret`), compared in
constant time against `JOB_SECRET` (Edge Function secret), falling back to
`SUPABASE_SERVICE_ROLE_KEY` only when `JOB_SECRET` is unset. The job secret may
be a legacy service-role JWT **or** a new `sb_secret_…` key — whatever is put in
Vault must be the same value the function expects in `JOB_SECRET`. The
service-role key is still used inside the functions for the admin API.

Test locally with `supabase functions serve --env-file supabase/.env.local`
(needs `SUPABASE_SERVICE_ROLE_KEY`).

### Job health

Failures are visible without reading container logs:

```sql
-- cron runs that didn't succeed in the last day
select * from public.job_failures();
-- pg_net deliveries with a 4xx/5xx or error in the last day
select * from public.http_failures();
```

Both are service-role only. `run_edge_job` also raises a `WARNING` (visible in
Postgres logs) when `functions_url`/`job_secret` are missing, instead of
silently doing nothing. The raw tables are `cron.job_run_details` and
`net._http_response`. `net` is owned by `supabase_admin`, so its default
anon/authenticated grants can't be revoked by migrations (the API already never
routes to it — see `api.schemas`); revoke them as `supabase_admin` in the
hosted SQL editor if you want them gone.

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
7. Give the nightly jobs their endpoint + shared secret via **Vault** (not a
   setting), and set the matching Edge Function secret `JOB_SECRET` (use a
   random value; do not reuse the service-role key):

   ```sql
   select vault.create_secret('https://<ref>.functions.supabase.co', 'functions_url');
   select vault.create_secret('<random job secret>', 'job_secret');
   ```

   The jobs are always scheduled; they become active once these secrets exist.

8. Enable CAPTCHA (Turnstile) and set `EXPO_PUBLIC_TURNSTILE_SITE_KEY` in the
   build env; `[auth.captcha]` is off locally, on in production.
9. Point the release build at the hosted URL/anon key and
   `EXPO_PUBLIC_INVITE_BASE_URL` (see `web/README.md` for the link site).
10. Before launch: turn on point-in-time recovery, review the security and
    performance advisors, and set anonymous-sign-in rate limits.

### Hosted auth checklist (per project)

`config.toml` only configures the local stack; set these in each hosted
project's dashboard:

- **SMTP** (`Auth → Email`): a real provider (host/port/user/pass + sender) so
  magic-link and confirmation mail actually sends. Without it, email sign-in
  silently fails in production.
- **Site URL + Redirect URLs**: `site_url` = the web origin, and
  `noticeboard://auth` (plus the web origin if used) in Redirect URLs, or
  linking/sign-in can't complete.
- **CAPTCHA** (`Auth → Settings`): Turnstile on with the secret, matching the
  app's `EXPO_PUBLIC_TURNSTILE_SITE_KEY`.
- **Email confirmations on** (`Auth → Email → Confirm email`). With manual
  linking enabled and confirmations off, anyone could link an email they don't
  control and claim it.
- **Email templates show the code**: the Magic Link, Confirm signup and Change
  Email templates must contain `{{ .Token }}` (the 6-digit code), not only
  `{{ .ConfirmationURL }}` — the app only accepts the code. `[auth.email]` sets
  `otp_length = 6` and `otp_expiry = 600`; raise `[auth.rate_limit]
  email_sent` for the code flow.
- **Anonymous sign-ins on** and a per-IP rate limit (Auth → Rate Limits).
- **Apple provider on** (`Auth → Providers → Apple`): Apple Developer Services
  ID as Client ID + the `.p8` private key as Secret (needs a paid Apple
  Developer account). Without this, "Continue with Apple" opens a provider
  error page.
- **Google provider on** (`Auth → Providers → Google`): Google Cloud OAuth
  client ID + client secret. Register the Supabase callback URL
  (`https://<ref>.supabase.co/auth/v1/callback`) as an authorized redirect URI
  in the Google console, plus the iOS bundle id / Android package + SHA-1 on
  the respective OAuth clients. Without this, "Continue with Google" fails the
  same way.

## Tests & CI

- **Unit** (`node scripts/run-unit-tests.cjs`) — compiles the pure modules
  (`src/utils/*`) and runs `node:test` suites in `scripts/unit` (layout,
  note helpers).
- **DB** (`supabase test db`) — pgTAP suites in `supabase/tests/`:
  `01_tables_rls`, `02_boards`, `03_items`, `04_entries`, `05_invites`,
  `06_storage`, `07_accounts`, `08_jobs`, `09_position`, `10_privileges`,
  `11_authz`, `12_expiry`, `13_service_role`.
- **Edge Functions** — `deno check supabase/functions/*/index.ts` (in the
  `check` job).
- **CI** (`.github/workflows/ci.yml`): job `check` = `npm ci
  --legacy-peer-deps` → `tsc --noEmit` → `expo lint` → unit tests → deno check;
  job `database` = `supabase/setup-cli` → `supabase start` → `db reset` →
  `test db` → `db lint`.
- **Deploy** (`.github/workflows/deploy.yml`, manual `workflow_dispatch`):
  dry-runs then pushes migrations, deploys the Edge Functions, sets
  `JOB_SECRET`, verifies the `functions_url`/`job_secret` Vault secrets exist,
  and lints the remote schema with warnings as failures. Pick the environment
  (`notice-dev`/`notice-prod`); each has its own `SUPABASE_PROJECT_REF`,
  `SUPABASE_DB_PASSWORD`, `JOB_SECRET`, and `SUPABASE_DB_URL` — the
  **session-pooler** connection string (GitHub runners lack IPv6, so the
  direct `db.<ref>` host is unreachable) — plus a shared
  `SUPABASE_ACCESS_TOKEN`. Migrations reach production only through this
  workflow.

## Secrets

Never in the repo: service-role key, Turnstile secret, Supabase access token.
They live in GitHub secrets, Supabase Vault, or Edge Function secrets.
`.env.example` lists only public values.
