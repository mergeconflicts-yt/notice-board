# Prod checklist

## 1. Nothing has actually run yet. 
None of the tests ran in my sandbox. Run these locally, and all must pass:
- `supabase db reset && supabase test db`
- `supabase db lint --level warning --fail-on warning`
- `npm ci && npm run typecheck && npm run lint && node scripts/run-unit-tests.cjs`

## 2. Device tests on a production build, not Expo Go:
- Apple and Google linking, and signing in on a second phone
- the magic link on a phone that already has a session
- Turnstile
- invite and board links on a cold start
- relaunching with the phone locked
- deleting an account

## 3. Production Supabase settings
`config.tom1` only covers your local setup, so the hosted project needs:
- captcha on (it's `enabled = false` locally)
- email confirmations on
- custom SMTP (the built-in sender only sends a couple of emails an hour)
- `noticeboard://auth` in the redirect URLs
- the Vault secrets `invite`, `functions_url` and `job_secret`
- `JOB_SECRET`, `SUPABASE_DB_URL` and the other secrets in GitHub
- a manual run of deploy. yml
- a check of `http_failures()` the next day to confirm the nightly jobs ran

## 4. Store requirements:
- No `eas.json` means no way to make store builds yet.
- A privacy policy URL is required by both stores. You store names, photos and optionally email addresses.
- Report and block for posted content. Apple's guideline 1.2 asks apps where people post content to others to let them report or block. Your boards are private and invite-only, but reviewers often still ask. A "Report" action on a post plus
"Remove member" is usually enough. Moderation was out of scope in your plan, so decide this now.
- App Privacy details for the App Store and the Data safety form for Play.
- The bundle id `com.noticeboard.app` is generic. Make sure you own it before you register it.

## 5. Migrations: 
They've been edited in place throughout. Before the first db push to production, confirm nothing has ever been pushed there. After that, only add new migrations and never edit old ones.
