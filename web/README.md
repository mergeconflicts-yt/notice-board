# Invite link landing site

Static site for universal links (docs/plan.md §11): the app-site association
files and the `/j/<token>` fallback page that opens the app.

Nothing here is hard-coded. `build.mjs` generates `public/` from environment
variables at deploy time, so the association files always carry real IDs.

## Deploy (Vercel)

1. Create a Vercel project with **Root Directory = `web`**. `vercel.json`
   already sets `buildCommand: node build.mjs` and `outputDirectory: public`.
2. Set the project env vars (see `.env.example`):
   - `APPLE_TEAM_ID` — Apple Developer team id
   - `ANDROID_SHA256` — app signing SHA-256 fingerprint (`eas credentials`)
   - `APP_STORE_ID` — numeric App Store id
   - optional `IOS_BUNDLE_ID`, `ANDROID_PACKAGE`
3. Deploy. The build fails if a required var is missing, so placeholder IDs
   can never ship.
4. Set `EXPO_PUBLIC_INVITE_BASE_URL` to the deployed origin (app `.env`,
   CI/prod secrets) — also used by the Turnstile base URL and share links.

## How it works

- iOS/Android verify the domain via `/.well-known/*`, then open
  `https://<host>/j/<token>` in the app (`noticeboard://j/<token>`).
- Browsers land on `/j.html`, which immediately tries the custom scheme and
  offers store links as a fallback.

Universal links need a development/production build — not Expo Go.
