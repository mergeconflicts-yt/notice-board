# Hosted setup — Fridge Board

What has actually been configured outside this repo, and what is still open.
Repeat per hosted project (`Fridge-Board-dev` first, then the prod twin).

## Hosting checklist

- [x] `Fridge-Board-dev` created — Data API on, auto-expose off, auto-RLS on.
- [x] Vault `invite`, `functions_url`, `job_secret` created.
- [x] GitHub env `SUPABASE-Dev` + scoped `SUPABASE_ACCESS_TOKEN` (8 permissions, see below).
  (Renamed from `notice-dev` 2026-09-28 — secrets already lived in
  `SUPABASE-Dev`, so `deploy.yml` was switched to
  `[SUPABASE-Dev, SUPABASE-prod]` instead of re-entering everything.)
- [x] Redirect `fridgeboard://auth` added (remove old `noticeboard://`).
- [x] Rename to Fridge Board — `fridgeboard://`, `com.fridgeboard.app`.
- [x] Local verify: reset + 487 pgTAP + lint + tsc + 33 unit pass, patch applied.
  CI `check` + `database` green on main 2026-09-28 after the JSR pin fix (see CI fix note).
- [x] Auth: anonymous ON + manual linking ON confirmed (per-IP rate limit NOT set — discussed 2026-09-28, explicitly excluded; values proposed but not applied — see Rate limits note).
- [x] SMTP via Resend (key + subdomain + sender + 1s interval) + `{{ .Token }}` in 3 templates mirrored + Confirm email ON verified 2026-09-28.
- [x] Turnstile CAPTCHA on (Managed, pre-clearance OFF, `fridge-board.kranehx.com`) + site key in EAS env (2026-09-28).
- [x] Google OAuth: Web ID/secret + callback in Supabase; iOS + Android clients created (EAS SHA-1) — free, no Apple account needed (2026-09-28).
- [ ] Apple (Services ID + `.p8`) — DEFERRED: no Apple Developer account. Blocks link-site `APPLE_TEAM_ID`/`APP_STORE_ID` too.
- [ ] Run Deploy workflow → `SUPABASE-Dev`; fix verify until green.
- [ ] Link site — DEFERRED (needs Apple IDs; `build.mjs` fails by design without them). Interim `EXPO_PUBLIC_INVITE_BASE_URL=https://fridge-board.kranehx.com`. No Vercel needed: will merge `web/public/` into the existing Cloudflare host later.
- [x] EAS project linked (`@mergeconflictss-team/fridge-board`) + prod env 4 vars set (2026-09-28); still to do: `eas build --profile production` → real-device tests.
- [ ] Check `http_failures()` the next day.
- [ ] Repeat all for the prod project + PITR + advisors + rate limits.
- [ ] Store listings: privacy URL, App Privacy/Data safety, own `com.fridgeboard.app`.

## Hosted Supabase project — DONE

- Project created: **Fridge-Board-dev** (no prod project yet).
- Project-creation toggles: Data API **on**, auto-expose new tables **off**
  (matches `auto_expose_new_tables = false`), automatic RLS **on**.
- Accepted notice: anonymous users sign in under the `authenticated` role.
  Safe here — guests start with zero memberships, table writes are revoked
  for both roles, reads are membership-scoped, every RPC re-checks membership.

## Vault secrets — DONE

SQL Editor, run as `postgres`:

```sql
select vault.create_secret('<invite-key-hex>', 'invite');
select vault.create_secret('https://<ref>.functions.supabase.co', 'functions_url');
select vault.create_secret('<job-secret-hex>', 'job_secret');
```

Verified: `select name from vault.secrets …` returns all three.
`<job-secret-hex>` is saved as the GitHub `JOB_SECRET` — the two must match
exactly or every nightly job 403s (deploy.yml compares them first).

## GitHub — DONE

- Environment `SUPABASE-Dev` holds `SUPABASE_PROJECT_REF`,
  `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL` (session-pooler `:6543` URL with
  the real password — runners have no IPv6, so `db.<ref>` is unreachable),
  and `JOB_SECRET`. (Prod twin will be `SUPABASE-prod`.)
  `SUPABASE_DB_URL` keeps its `?pgbouncer=true` suffix (pooler hint for the
  CLI); deploy strips it (`${SUPABASE_DB_URL%%\?*}`) for `psql` calls only —
  libpq rejects unknown URI query params.
- Shared repo secret `SUPABASE_ACCESS_TOKEN`: scoped PAT (1-yr expiry —
  only used for manual deploys, so a short expiry just breaks deploys later;
  longest offered), scoped to this one project. Classic full-access token
  avoided on purpose — a leak would touch every project on the account.
  Tokens are immutable: permissions can't be edited after creation, so scope
  changes mean creating a new token, pasting it over the repo secret, and
  revoking the old one (done 2026-09-28 for `api_gateway_keys_read`).
  Granted (everything else None):

  | Permission | Access | Why the deploy needs it |
  |---|---|---|
  | Project Settings | Read | was for `supabase link` — link step removed 2026-09-28 (CLI status-endpoint bug, supabase/cli#3705/#6392); deploy now uses `--db-url` / `--project-ref`, scope kept harmlessly |
  | Migrations | Read & Write | `db push` applies migration history |
  | Database | Read | remote lint + verify-step schema reads (writes go via migrations/`SUPABASE_DB_URL`, not the token) |
  | Auth Config | Read | verify step reads captcha/confirmations/allowlist/SMTP |
  | Edge Functions | Read & Write | deploys the 4 functions |
 | Edge Function Secrets | Read & Write | sets `JOB_SECRET` on the functions |
 | Storage | Read | verify step checks both buckets are private |
 | API Gateway Keys | Read | `supabase link` fetches the project's API keys (added 2026-09-28 — Link step failed without it: `Missing required permission(s): api_gateway_keys_read`) |

## Auth dashboard — PARTIAL (emails + captcha + Google done; Apple deferred)

Done 2026-09-28 (with reasons):
- Redirect allowlist contains `fridgeboard://auth` (was `noticeboard://`
  before the rename — confirm the old entry is gone).
  Reason: app's PKCE redirect for identity linking; without it OAuth/linking
  can't complete.
- Anonymous sign-ins ON + manual linking ON confirmed (`Authentication →
  Providers → Anonymous`, `Authentication → Settings → Sign In/Up`).
  Reason: guest mode IS `signInAnonymously()` (no local-only data — boards
  are shared so they must live on the server); Profile → Save your account
  uses `linkIdentity()` to attach Apple/Google/email to the same guest
  `user.id` so boards are kept. OFF = guest flow + saving both break.
  Rate limits: discussed but explicitly NOT applied this round (see note).
- Resend: API key created; subdomain linked via Cloudflare DNS (TXT/MX
  `DNS only`, not proxied, until Verified).
  Reason: hosted Supabase has no working built-in sender (a couple of
  emails/hour); the 6-digit-code flow sends one email per sign-in.
- SMTP: `Authentication → Emails → Enable custom SMTP: ON`,
  host `smtp.resend.com`, port `587`, user `resend`, pass = Resend API key
  (`re_…`, never in repo); sender email `noreply@<verified-subdomain>`
  (must be the verified subdomain or Resend 403s), sender name
  `Fridge Board` (shows as `Fridge Board <…>` in inbox).
- Minimum interval per user: `1s` (matches `supabase/config.toml`
  `max_frequency = "1s"`).
  Reason: the app throttles Resend itself (30s cooldown); this dashboard
  value must not block it — the `30/hour` project rate limit is the real
  abuse guard.
- Confirm email: ON verified (`mailer_autoconfirm` must be false — deploy
  verify checks it). Custom `smtp_host` set (verify checks that too).
- Email templates mirrored into the dashboard, all carrying `{{ .Token }}`
  (app only accepts the 6-digit code, not the magic-link URL): Magic Link
  (`Your Fridge Board sign-in code` ← `supabase/templates/magic_link.html`),
  Confirm signup (`Your Fridge Board code` ← `confirmation.html`),
  Change Email (`Confirm your new email` ← `email_change.html`).
  (`otp_length = 6`, `otp_expiry = 600`.)
- CAPTCHA: Turnstile ON with secret (`Project Settings → Auth → Bot and
  Abuse Protection`, provider `turnstile`; secret never in repo).
  Widget decisions: mode **Managed** (invisible for most, challenge only
  high-risk traffic — fits the 320×90 WebView in
  `src/components/Turnstile.tsx`; Non-interactive would spinner every
  sign-in, Invisible gives no visible cue on failure); **pre-clearance OFF**
  (only mints one-time `captchaToken`s for Supabase auth — the cookie never
  leaves the WebView, buys nothing for WAF); hostnames:
  `fridge-board.kranehx.com` (had to create the `fridge-board` CNAME in
  Cloudflare DNS first — the hostname picker only lists existing DNS names).
- Google: `Authentication → Providers → Google → Enabled` with Web
  Client ID + secret. Consent screen: Branding `Fridge Board` + support
  email, Audience External + self as test user, scopes profile/email only.
  Callback registered in Google Cloud:
  `https://sdnedarmmvcgnkergxri.supabase.co/auth/v1/callback`
  (project ref from `EXPO_PUBLIC_SUPABASE_URL`). Native clients also
  created: Android (package `com.fridgeboard.app` + EAS production SHA-1
  from `npx eas-cli credentials` → Android → production keystore; add
  Play's SHA-1 as a second client after Play signing) + iOS (bundle id
  `com.fridgeboard.app`). Reason: Google OAuth is free (unlike Apple);
  v1 app flow uses the Web client via browser OAuth — native clients are
  ready for later native sheets + Play integrity.
- Site URL: interim decision — `EXPO_PUBLIC_INVITE_BASE_URL` +
  Supabase Site URL target = `https://fridge-board.kranehx.com`
  (see Link-site decision below). Turnstile `baseUrl`
  (`src/components/Turnstile.tsx:51`) uses the same origin, so all three
  must match; captcha validates the widget allowlist even before link
  files exist.

Open:
- **Apple**: Services ID + `.p8` — DEFERRED, needs paid Apple Developer
  account. Without it "Continue with Apple" opens a provider error page
  (acceptable for now; Google + email + guest cover testing).
- **Rate limits**: NOT set (discussed 2026-09-28, excluded by choice).
  Proposed values matching `supabase/config.toml:200-215` (dashboard shows
  per-hour; config is per-5min for 4 of them): emails/hour `30`
  (`email_sent`), SMS/hour `30`, token refreshes `1800` (=150/5min),
  token verifications `360` (=30/5min), anonymous/hour/IP `30`,
  sign-ups+sign-ins `360` (=30/5min), Web3 `360`. Reason for 30/h email +
  30/5min verify: every code sign-in sends one email; too low 429s
  resend/verify on real phones. Apply when ready (prod needs
  `email_sent` raised with volume).

## EAS — LINKED, env set, build not done (2026-09-28)

- Project linked via `npx eas-cli init` (note: newer CLI has no `link`
  subcommand — `init` → "Link to existing project?" is the path).
  Dashboard project `@mergeconflictss-team/fridge-board`,
  ID `8b5574fa-2fe2-4c77-bdd3-b1850938965c` (in `app.json`
  `extra.eas.projectId`). Reason for linking: `eas build/credentials/env`
  need a cloud project record; unlinked = dashboard env vars have nowhere
  to attach and CLI doesn't know what to build.
- Why EAS at all: the app IS Expo (`expo-router`, `app.json`,
  `app.config.ts`, `eas.json`); prod binaries (IPA/AAB, signing, OTA,
  per-profile env, `associatedDomains`/intent filters from
  `app.config.ts:40-53`, native Apple/Google auth) only exist in real
  builds — never Expo Go. No local `ios/`/`android/` dirs (CNG), so EAS
  is the supported path (`prod-checklist.md §4`, `AGENTS.md`).
- Prod env (all **plaintext** — `EXPO_PUBLIC_*` ships in the client bundle
  by design; `sensitive`/`secret` would trip the fail-fast check in
  `app.config.ts:22-32`. Real secrets — service-role key, Turnstile
  secret, `SUPABASE_ACCESS_TOKEN` — never go here):
  `EXPO_PUBLIC_SUPABASE_URL=https://sdnedarmmvcgnkergxri.supabase.co`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` set (anon public key — RLS protects
  data), `EXPO_PUBLIC_INVITE_BASE_URL=https://fridge-board.kranehx.com`
  (interim, see below),
  `EXPO_PUBLIC_TURNSTILE_SITE_KEY` set (public half; secret only in
  Supabase). Verified via `npx eas-cli env:list --environment production`.
- Still to do: `eas build --profile production` → real-device tests
  (guest, Google, email codes, Turnstile, custom-scheme invites
  `fridgeboard://j/<token>` + code paste — `https://` auto-open waits
  for link files).

## Link site / domain decision — DEFERRED (no Apple account)

- Decision 2026-09-28: park the link-site file deploy until the paid Apple
  account exists. Reason: `web/build.mjs` requires `APPLE_TEAM_ID` +
  `ANDROID_SHA256` + `APP_STORE_ID` and exits 1 if any is missing (by
  design, so placeholder IDs never ship). Two of three need Apple
  (Team ID from Membership, numeric App Store ID from App Store Connect).
- Decision: NO Vercel needed. `web/public/` is pure static files — serve
  from the existing Cloudflare host instead. When Apple IDs exist: run
  `APPLE_TEAM_ID=… ANDROID_SHA256=… APP_STORE_ID=… node web/build.mjs`,
  add `web/public/_headers` (both `.well-known/*` as `application/json`,
  plus `X-Robots-Tag: noindex, nofollow` + `Referrer-Policy: no-referrer`)
  and `web/public/_redirects` (`/j/* /j.html 200` — the Vercel equivalents
  in `web/vercel.json`), deploy as a separate Pages project on the
  subdomain (don't merge into the apex — `/.well-known` would clash).
- Decision: use subdomain `fridge-board.kranehx.com` (not apex
  `kranehx.com`) as the Fridge Board origin for invite base + Site URL +
  Turnstile domain. Reason: keeps board links/universal links/Turnstile
  scoped to one host; the apex hosts other things.
- Verified live 2026-09-28: `https://fridge-board.kranehx.com/` serves the
  marketing site (`website/`), but still branded **Notice Board** (rename
  to Fridge Board pending) and `/.well-known/apple-app-site-association`
  + `/j/test-token` both 404 (expected — Apple IDs missing).
  `privacy.html` serves the old Notice Board copy (needs sync with
  `web/build.mjs` legal text later).
- Interim (works now): Turnstile + Site URL + invite base all point at
  `https://fridge-board.kranehx.com` even though link files aren't there —
  captcha only checks the widget allowlist, and custom-scheme invites +
  code paste cover testing until `https://` auto-open lands (needs a fresh
  EAS build after, since `app.config.ts` bakes the host into
  `applinks:`/intent filters).

## Backend shape (what the deploy pushes)

- 12 migrations (`20260925…00_init` → `…11_vintage_fridge_colors`): tables,
  RPC-only writes, membership-scoped RLS, invites, storage policies,
  accounts, pg_cron/pg_net jobs, realtime, service-role hardening, extra
  fridge colours. Migration history on hosted is empty — first push is clean.
- 4 Edge Functions: `delete-account` (`verify_jwt = true`, admin deletes the
  auth user), `upload-photo` (`verify_jwt = true`, sole writer of
  `board-photos` bytes), `purge` + `cleanup-users` (`verify_jwt = false`,
  self-auth via Vault `job_secret` vs `JOB_SECRET` bearer).
- Cron (created by migrations, inert until Vault secrets exist):
  `expire-items`, `purge-nightly`, `cleanup-users-nightly`,
  `cleanup-upload-intents`. Health: `public.job_failures()`,
  `public.http_failures()` (service-role only).
- Buckets `board-photos` + `avatars` are private; no direct client uploads.

## CI fix — Edge Function JSR pin (2026-09-28; repo code, not hosted config)

- First CI run on main failed at `deno check
  supabase/functions/*/index.ts`: the 4 functions imported floating
  `jsr:@supabase/supabase-js@2`, which resolved to 2.117.2 while the npm
  lockfile pins 2.116.0 — with no `deno.json`, Deno runs
  bring-your-own-node-modules mode and couldn't find
  `npm:@supabase/realtime-js@2.117.2`. Not caused by the env rename; any
  merge would have hit it once JSR published 2.117.2 (local verify never
  ran this step — Deno wasn't installed locally).
- Fix: pinned all 4 functions to `jsr:@supabase/supabase-js@2.116.0`
  (matches `package.json` `^2.116.0` + lockfile — deterministic from now).
  This unmasked 3× TS7006 implicit-any in `purge` (`rpc()` without
  generated types returns untyped data): added `StaleItem = { id: string;
  photo_path: string | null }`, matching `expired_for_purge → setof items`
  (`20260925000005_jobs.sql:39`); runtime identical (compile-time cast).
- Verified: `deno check` (exact CI command) + `tsc` + `expo lint` + local
  `db reset` + 487 pgTAP + 33 unit + `db lint` green; CI green after push.

## App identity (post-rename)

- Name **Fridge Board**, slug `fridge-board`, scheme `fridgeboard://`
  (`fridgeboard://auth` OAuth, `fridgeboard://j/<token>` invites).
- iOS bundle id + Android package: `com.fridgeboard.app`.
- Share/email copy, `supabase/config.toml` subjects + redirect comments,
  website + link site, docs, and deploy.yml's allowlist check all renamed.
  Migration header comments still say "Notice Board" (history, untouched).
- `package-lock.json` still says `notice-board` until the next install.

## Where to find each setting

Supabase dashboard (`supabase.com/dashboard/project/<ref>` — the `<ref>`
in the URL is the project ref):

- Project creation toggles: asked once on New Project (Data API,
  auto-expose, automatic RLS).
- Project ref: the URL itself, or Settings → General.
- Anon key: Settings → API → `anon public`.
- Session-pooler URL: top-bar **Connect** → dropdown → Prisma/Drizzle →
  the `:6543/...?pgbouncer=true` `DATABASE_URL` (fill in `[YOUR-PASSWORD]`).
- Access tokens (the `sbp_…` deploy token): account avatar → Access Tokens.
- Vault secrets: sidebar **Vault** → Secrets (or SQL Editor as `postgres`).
- Redirect allowlist: **Authentication** → URL Configuration → Redirect URLs.
- Site URL: same page, Site URL field.
- Anonymous + manual linking + signup: **Authentication** → Providers →
  Anonymous / Email; **Authentication** → Settings (Sign In/Up) → manual
  linking.
- SMTP + templates + confirmations: **Authentication** → Emails (SMTP
  section, template editors, Confirm email toggle).
- Turnstile CAPTCHA: Project Settings → Auth → Bot and Abuse Protection.
- Apple/Google providers: **Authentication** → Providers → Apple / Google.
- Supabase callback for Google: `https://<ref>.supabase.co/auth/v1/callback`.
- Buckets: sidebar **Storage**. Cron jobs: **Database** → pg_cron (or
  `select * from cron.job;` in SQL Editor). Function logs + secrets:
  sidebar **Edge Functions**.

Google Cloud (`console.cloud.google.com`, 2026 UI = Google Auth Platform):
- Consent screen: **Auth Platform** → Branding (app name, support email) →
  Audience (External + test users) → Data Access (scopes — none needed
  beyond profile/email).
- Client IDs/secrets: **Auth Platform** → Clients → Create Client → Web
  (Supabase callback as Authorized redirect URI), iOS (bundle id), Android
  (package + SHA-1).
- SHA-1 source: `npx eas-cli credentials` → Android → production keystore.

GitHub repo: Settings → Environments → `SUPABASE-Dev` (`SUPABASE_PROJECT_REF`,
`SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL`, `JOB_SECRET`); shared
`SUPABASE_ACCESS_TOKEN` under repo Settings → Secrets. Deploys run from
Actions → Deploy database → `SUPABASE-Dev`.

Resend (`resend.com`, DONE 2026-09-28): API key created; subdomain linked via
Cloudflare (records `DNS only` until Verified); SMTP `smtp.resend.com:587`,
user `resend`, pass = API key (`re_…`, never in repo); sender on verified
subdomain, name `Fridge Board`; min interval `1s` (matches `max_frequency`);
3 templates mirrored with `{{ .Token }}`; Confirm email ON verified.

EAS (`expo.dev`, DONE link + env 2026-09-28): project
`@mergeconflictss-team/fridge-board` (`8b5574fa-2fe2-4c77-bdd3-b1850938965c`,
linked via `eas init`); prod env plaintext: `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_INVITE_BASE_URL`
(`https://fridge-board.kranehx.com`, interim), `EXPO_PUBLIC_TURNSTILE_SITE_KEY`.
Dashboard path: project → Environment variables → Production. Build not run yet.

Turnstile (Cloudflare, DONE 2026-09-28): widget `Fridge Board dev`, mode
Managed, pre-clearance OFF, hostnames `fridge-board.kranehx.com` (CNAME
created first so it appears in the picker); site key → EAS prod env,
secret → Supabase Bot Protection only.

Google Cloud (DONE 2026-09-28, free): consent External + test user,
profile/email scopes; Web client (callback
`https://sdnedarmmvcgnkergxri.supabase.co/auth/v1/callback`) → ID/secret in
Supabase Providers → Google → Enabled; Android client (`com.fridgeboard.app`
+ EAS production SHA-1; add Play SHA-1 later) + iOS client
(`com.fridgeboard.app`).

Deferred (no Apple Developer account): Apple provider, `APPLE_TEAM_ID` /
`APP_STORE_ID`, link-file deploy (`/.well-known`, `/j/*`), store listings.
