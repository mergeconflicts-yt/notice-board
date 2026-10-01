# Invite link landing site

Static site for universal links (docs/plan.md §11): the app-site association
files and the `/j/<token>` fallback page that opens the app.

Nothing here is hard-coded. `build.mjs` generates `public/` from environment
variables at deploy time, so the association files always carry real IDs.

## Deploy (Cloudflare Pages)

The output is plain static files, so it's served by Cloudflare (no Vercel).
`web/vercel.json` is kept only as the historical Vercel equivalent and is
ignored by Cloudflare.

1. Run the build with the required env vars (see `.env.example`):
   - `APPLE_TEAM_ID` — Apple Developer team id
   - `ANDROID_SHA256` — app signing SHA-256 fingerprint (`eas credentials`)
   - `APP_STORE_ID` — numeric App Store id
   - optional `IOS_BUNDLE_ID`, `ANDROID_PACKAGE`

   ```sh
   APPLE_TEAM_ID=… ANDROID_SHA256=… APP_STORE_ID=… node web/build.mjs
   ```

   The build fails if a required var is missing, so placeholder IDs can never
   ship. Output goes to `web/public/`.
2. Serve `web/public/` from Cloudflare Pages (its own project/subdomain, or
   merged into the marketing site's output). `build.mjs` now also emits the
   Cloudflare equivalents of `vercel.json`:
   - `_redirects` — `/j/*  /j.html  200`
   - `_headers` — `application/json` for `/.well-known/*`, and
     `X-Robots-Tag: noindex, nofollow` scoped to `/j/*` only (never
     site-wide, so a co-hosted marketing site stays indexable).
3. Set `EXPO_PUBLIC_INVITE_BASE_URL` to the deployed origin (app `.env`,
   CI/prod secrets) — also used by the Turnstile base URL and share links.

## How it works

- iOS/Android verify the domain via `/.well-known/*`, then open
  `https://<host>/j/<token>` in the app (`fridgeboard://j/<token>`).
- Browsers land on `/j.html`, which immediately tries the custom scheme and
  offers store links as a fallback.

Universal links need a development/production build — not Expo Go.
