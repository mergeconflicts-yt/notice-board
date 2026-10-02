# Store listing runbook — Fridge Board

Everything the App Store and Play Console ask for, with the answers already
filled in from `website/privacy.html` and the shipped app. Work top-down:
nothing below §4 can ship until the gated items pass their verify scripts.

## 1. Support email (GATE — fails until Email Routing is on)

`contact@fridge-board.kranehx.com` is advertised on
`website/contact.html`, the privacy policy, the link-site contact page
(`web/build.mjs`), the homepage JSON-LD, and both store listings. It needs
a receiver on the subdomain — note Cloudflare Email Routing onboards **root
domains only**, so it cannot be enabled for the subdomain from the
`kranehx.com` zone. Two free paths:

- **Native**: add `fridge-board.kranehx.com` to Cloudflare as its own zone
  (NS delegation from the parent), re-create the subdomain's DNS records
  (CNAME, etc.) in the new zone, then onboard Email Routing on it and add
  the `contact` rule. Keeps everything in one dashboard.
- **Fastest**: add the subdomain at ForwardEmail.net (free) and set its
  two MX records (`mx1/mx2.forwardemail.net`) on
  `fridge-board.kranehx.com` in the existing zone; mail forwards to your
  inbox. No zone surgery; the site's DNS stays untouched.

- Gate: `sh scripts/verify-support-email.sh` (must print OK).
- SPF note: keep a single SPF TXT per name — if a receiver asks for one on
  the subdomain, merge it with Resend's
  (`v=spf1 include:amazonses.com …`), never two records.
- Then send an outside test message and confirm arrival before submitting
  listings.
- Replying as the address: Email Routing is forward-only — use Gmail
  "Send mail as" with the Resend SMTP credentials (`smtp.resend.com:587`).
- The address is hard-coded in `website/contact.html`,
  `website/index.html` (JSON-LD), `web/build.mjs` (link-site contact page)
  and below — change all five if the address ever moves.

## 2. Store buttons (repo-side DONE — awaiting listings)

All six store buttons (index, families, roommates) carry
`data-placeholder` and are neutered by JS into inert "(soon)" pills, so
nothing 404s pre-launch (verified headless). At launch: publish the
listings, then **remove the `data-placeholder` attributes** (not the CSS
rule) so the real links activate. The App Store href still carries the
`id0000000000` placeholder until the numeric App Store ID exists.

## 3. Association files (GATE — needs paid Apple account)

`/.well-known/apple-app-site-association` + `assetlinks.json` are generated
by `web/build.mjs`, which fails fast without `APPLE_TEAM_ID`,
`ANDROID_SHA256`, `APP_STORE_ID`. Two of three need the Apple Developer
account. Until then `fridgeboard://` links + code paste cover invites, and
the Maestro `coldstart-invite` prod flow covers the same in-app path.

## 4. Screenshots (repo-side DONE — one retake outstanding)

`store-screenshots/out/` holds six 1290×2796 (6.7") PNGs, regenerated with
the current mockups. Still needed before submission:

- **Retake `assets/welcome.png`**: the previous capture showed Apple +
  Google buttons and was quarantined to `assets/stale/` (it contradicted
  the release: no Apple login ships, Google is gated off iOS — a
  Guideline 4.8-relevant mismatch). Panel 1 currently uses the accurate
  drawn mockup. Retake rule: capture from the **release build** (email +
  guest only on iOS), then re-run `node store-screenshots/export.mjs`.
- **6.5" set** (1242×2688): downscale the 6.7" PNGs (see
  `store-screenshots/README.md`); **iPad 13"** only if Apple asks.
- Never ship a capture showing a login option the build does not offer.

## 5. Apple App Privacy (ready to paste)

No tracking, no ads, no analytics SDKs, no third-party sharing for
advertising. Data collected, linked to the user, purpose **App
Functionality**:

| Data type | When | Notes |
| --- | --- | --- |
| Name (display name) | Always (guest or saved) | User-entered, shown to board members |
| Email Address | Only with email sign-in / saved account | 6-digit code auth; never for guests |
| User ID | Only with linked Apple/Google account | Provider subject + internal account id |
| Photos | Only photos the user posts | Resized + re-encoded, EXIF/GPS stripped |
| Other User Content | Notes, lists, dates the user posts | Visible only to invited board members |

Data is hosted by Supabase (processor, TLS in transit) and never sold,
never used for tracking or advertising. Deletion: in-app Delete account
(You screen); guest sign-out deletes the guest account outright.

## 6. Google Data Safety (ready to paste)

- **Collects**: Name, Email address (email sign-in only), Photos (user
  posts only), Files and docs (notes/lists/dates the user posts).
- **Shares**: None (processors only: Supabase hosting, Cloudflare
  Turnstile bot protection, Apple/Google only when the user links them).
- **Security**: Encrypted in transit; users can request deletion (in-app
  Delete account + `website/contact.html` data requests, 30-day response).
- **Not collected**: location, contacts, advertising IDs, app
  interactions/analytics.

## 7. Review-day notes

- **Demo access**: none needed — the app opens as a guest with no login.
  Tell review to tap "Use as guest".
- **UGC moderation** (both stores ask): any member can Report a post to the
  board owner from the post screen; owners can remove posts/members and
  block rejoin (Fridge settings → Safety). State this in the review notes.
- **Export compliance (Apple)**: standard TLS only — exempt, no ERN.
- **Content rating**: Everyone / 3+ with UGC questionnaire answered per §UGC.
- **Privacy policy URL**: `https://fridge-board.kranehx.com/privacy.html`.
- **Apple login**: iOS ships email + guest only in this release (Google is
  gated off iOS in `src/lib/authProviders.ts`), so Guideline 4.8 does not
  trigger. Revisit only if Google returns to iOS.
