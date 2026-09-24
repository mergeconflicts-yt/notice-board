# Invite link landing site

Static site for universal links (docs/plan.md §11). Holds the app-site
association files and the `/j/<token>` fallback page that tries to bounce the
visitor into the app.

## Deploy (Vercel)

1. Deploy this `web/` folder to a free Vercel (or Netlify) project.
2. Set `EXPO_PUBLIC_INVITE_BASE_URL` to the deployed origin, e.g.
   `https://noticeboard-app.vercel.app` (app `.env`, and CI/prod secrets).
3. Replace the placeholders:
   - `web/.well-known/apple-app-site-association`: `TEAMID` → your Apple team id.
   - `web/.well-known/assetlinks.json`: the real SHA-256 signing fingerprint
     (`eas credentials` prints it).
   - `web/j.html`: the App Store id.

## How it works

- iOS/Android verify the domain via the association files, then open
  `https://<host>/j/<token>` directly in the app (`noticeboard://join/<token>`).
- Browsers land on `/j.html`, which immediately tries the custom scheme and
  offers store links as a fallback.

Universal links require a development/production build — they do not work in
Expo Go.
