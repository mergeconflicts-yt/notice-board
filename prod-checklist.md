# Prod checklist

## 1. Run these locally, and all must pass:
- `supabase db reset && supabase test db`
- `supabase db lint --level warning --fail-on warning`
- `npm ci --legacy-peer-deps && npm run typecheck && npm run lint && node scripts/run-unit-tests.cjs` (plain `npm ci` fails on Expo 57 peer conflicts)
- `npm audit --omit=dev`: no high/critical. The `uuid` advisory is fixed via
  the `overrides` pin in `package.json` (`^11.1.1`; only `v4()` is used, and
  it is verified working). The `decode-uri-component` chain (CVE-2026-45822,
  malformed-URI CPU DoS via `query-string@7.1.3` via `expo-router@57`) is
  neutralised by `patches/decode-uri-component+0.2.2.patch` — a backport of
  the upstream single-pass decoder (v0.5.0) in CJS form, applied on every
  install via the `postinstall` hook; verified for output parity (16 cases)
  and O(n) behaviour on malformed input. A forced `npm audit fix` would NOT
  fix it (it proposes breaking expo-router@5 / expo@46 downgrades) and the
  only patched release (`0.5.0`) is ESM-only, which CJS `query-string@7`
  cannot consume — so audit still flags the version number even though the
  vulnerable code path is gone. Exposure was narrow regardless (only a tapped
  malicious deep link reaches the decoder; availability-only, no data impact).
  Re-check on every Expo SDK upgrade: drop the patch once `query-string`
  ships the fix in a CJS-compatible release.

## 2. Device tests on a production build, not Expo Go:
- Apple and Google linking, and signing in on a second phone
- the magic link on a phone that already has a session
- Turnstile
- invite and board links on a cold start
- relaunching with the phone locked
- deleting an account
- guest sign-out (deletes the guest account — confirm the boards are gone and
  no error toast appears)

## 3. Production Supabase settings
`config.toml` only covers your local setup, so the hosted project needs:
- captcha on (it's `enabled = false` locally)
- email confirmations on
- custom SMTP (the built-in sender only sends a couple of emails an hour)
- `noticeboard://auth` in the redirect URLs
- the Vault secrets `invite`, `functions_url` and `job_secret`
- `JOB_SECRET`, `SUPABASE_DB_URL` and the other secrets in GitHub
- a manual run of deploy.yml (it now ends with a fail-closed
  "Verify production security posture" step: captcha, confirmations, redirect
  allowlist, private buckets, Vault secrets and cron health — fix the dashboard
  and re-run if it fails)
- a check of `http_failures()` the next day to confirm the nightly jobs ran
- photo uploads go through the `upload-photo` Edge Function (server-side
  decode, non-image rejection, 2048px downsize, JPEG re-encode stripping
  EXIF/GPS; quotas 20 intents/hour/account, 1 GB/account). It deploys with
  the other functions in deploy.yml; local dev needs `supabase functions
  serve` running or photo posts fail with a network error.

## 4. Store requirements:
- Store builds run through `eas.json` (`development` for a dev client,
  `preview` for internal device testing, `production` for the release build:
  `eas build --profile production`). Set the four public env vars
  (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
  `EXPO_PUBLIC_INVITE_BASE_URL`, `EXPO_PUBLIC_TURNSTILE_SITE_KEY`) as EAS
  project environment variables for the production profile — a production
  build fails fast in `app.config.ts` when any is absent. The invite base URL
  is the deployed origin of `web/` (see `web/README.md`).
- Real-device production tests: see §2 above (all on a `production` build,
  not Expo Go).
- Privacy policy URL: `website/privacy.html` (with Terms and Contact pages
  beside it; the app links all three from You → Privacy/Terms/Contact). You
  store names, photos and optionally email addresses — all disclosed there.
- Report and block for posted content: any member can Report a post to the
  board owner from the post screen; owners review reports, remove/keep posts,
  and block members (blocked users can't rejoin even with a fresh link) in
  Fridge settings → Safety. Moderation was out of scope in your plan — this
  is the decided scope.
- App Privacy details for the App Store and the Data safety form for Play.
- The bundle id `com.noticeboard.app` is generic. Make sure you own it before you register it.

## 5. Migrations: 
They've been edited in place throughout. Before the first db push to production, confirm nothing has ever been pushed there. After that, only add new migrations and never edit old ones.
