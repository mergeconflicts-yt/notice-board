# Free-tier budget — Fridge Board

What every dependency costs at $0, what the app actually consumes, and what
forces the first paid upgrade. Planning scenario: launch = extended family
(~25 users, ~6 boards); headroom figures assume ~10× that. Verified against
vendor docs 2026-10-02 (links at the bottom); re-check yearly, free tiers
shrink without notice.

## Supabase — Free plan ($0; project `Fridge-Board-dev`)

| Resource | Free allowance | Our usage (est.) | Headroom |
|---|---|---|---|
| Database | 500 MB | Users + boards + items are rows of text: < 5 MB at 25 users, < 50 MB at 250 | ~100× |
| File storage | 1 GB | Photos ~300–600 KB @1600px/q75, 2-week retention; app-enforced 256 MB/account + 768 MB/project caps sit *inside* the 1 GB | Hard-capped by our own quotas |
| Bandwidth / egress | 5 GB/mo | Photo views dominate: ~10 users × 10 photos/day × 400 KB ≈ 1.2 GB/mo. Heavy-photo growth (25 users × 20/day) ≈ 6 GB/mo — **first ceiling** | ~4×, then Pro |
| Monthly active users | 50,000 | Tens | ~1000× |
| Edge Function invocations | 500K/mo ($2 per 1M over) | Uploads (hundreds/mo) + 4 nightly cron runs + rare deletes ≈ < 10K/mo | ~50× |
| Projects | 2 active free | Exactly 1 (single-project decision, see `hosted-setup.md`) | 1 spare, do not spend it |
| Backups / PITR | None (manual dumps only) | Acceptable pre-revenue; dump before risky changes | — |

Free-tier gotchas, not just quotas: projects **pause after 1 week of
inactivity** (restore from dashboard; launch traffic fixes this naturally),
**no PITR** (Pro add-on), edge **CPU ceiling ~2s/invocation** (the reason
`upload-photo` has a JPEG fast path — see `supabase/functions/_shared/jpeg.ts`).

**First paid trigger:** photo-heavy egress past 5 GB/mo → Pro $25/mo
(+ bigger quotas everywhere, backups, no pausing).

## Cloudflare — Free plan ($0)

| Resource | Free allowance | Our usage (est.) | Headroom |
|---|---|---|---|
| Turnstile challenges | Unlimited (20 widgets, 10 hostnames/widget) | 1 widget, 1 hostname; one challenge per sign-in ≈ hundreds/mo | Effectively infinite |
| Pages (marketing + invite site) | 500 builds/mo, unlimited bandwidth | Static KBs; deploys number in the tens/mo | ~10× |
| Pages Functions (`/j/*` invite fallback) | Under Workers free: 100K req/day | One hit per opened invite ≈ hundreds/day max | ~100× |
| Email Routing (support inbox) | Free, unlimited forwarding | Dozens of mails/mo | Infinite |

No paid trigger in sight at family scale. Note: Turnstile Managed mode
flags fresh WebViews as bot-like (observed 15/15 unsolved during testing) —
Non-interactive mode or protection-off is the current posture; see
`hosted-setup.md`.

## Resend — Free plan ($0)

| Resource | Free allowance | Our usage (est.) | Headroom |
|---|---|---|---|
| Transactional email | 3,000/mo, **100/day hard cap** | 1 email per email-sign-in; family scale < 10/day | ~10× daily |

The **100/day cap** is the binding constraint (monthly quota rarely matters
first). Auth rate limits (30 emails/hour hosted) sit well inside it.

**First paid trigger:** sustained > 100 sign-in emails/day → Pro $20/mo
(50K emails, no daily cap).

## EAS (Expo) — Free plan ($0)

| Resource | Free allowance | Our usage (est.) | Headroom |
|---|---|---|---|
| Builds | 15 Android + 15 iOS /mo, low-priority queue (90+ min waits at peak) | A few release builds + occasional fixes ≈ < 6/mo | ~5× |
| Submit | Included | Per release | Fine |
| EAS Update (OTA) | 1K MAUs | Tens | ~30× |

**First paid trigger:** queue pain during a hotfix week → Starter $19/mo
($45 build credit, high-priority queue). No code changes needed.

## Always-free / one-time

- **Google OAuth** (Cloud + Supabase provider): free, no quota concern.
- **GitHub Actions**: public repo = free unlimited minutes (private would be
  2,000 min/mo) — deploys take ~1 min.
- **Maestro / Supabase CLI / wrangler / Deno**: free dev tools.

## Paid, unavoidable

- **Apple Developer Program: $99/yr** — required for App Store listing,
  association files, App Store ID. (No way to ship iOS without it.)
- **Google Play: $25 one-time** — required for Play listing.

## Upgrade order if the app grows

1. Photo-heavy egress → Supabase Pro ($25/mo).
2. > 100 sign-in emails/day → Resend Pro ($20/mo).
3. Build-queue pain → EAS Starter ($19/mo).
4. Real revenue / compliance needs → Apple + Play fees already sunk;
   Supabase PITR/backup add-ons, Pro org split per `hosted-setup.md`.

## Sources (2026-10-02)

- Supabase Edge Functions pricing: https://supabase.com/docs/guides/functions/pricing
- Supabase Edge Functions limits (CPU/wall-clock): https://supabase.com/docs/guides/functions/limits
- Supabase pricing (free quotas): https://supabase.com/pricing
- Resend pricing (3,000/mo, 100/day): https://resend.com/pricing.md
- EAS pricing (15+15 builds, Update MAUs): https://expo.dev/pricing
- Turnstile plans (unlimited challenges on free): https://developers.cloudflare.com/turnstile/plans
- Pages limits (500 builds/mo): https://developers.cloudflare.com/pages/platform/limits
- Workers pricing (100K req/day free): https://developers.cloudflare.com/workers/platform/pricing
