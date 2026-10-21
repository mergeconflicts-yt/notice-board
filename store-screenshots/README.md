# App Store screenshots — Fridge Board

Design matches the reference: 6 panels, handwritten Caveat headlines, Nunito sub-copy,
brand pine `#0B4F41` / cream `#FBF5E9` / yellow `#F1D876`, phone mockups built from the
app's real tokens (`src/theme/colors.ts`, `NotePaper`).

## Preview

Open `store-screenshots/index.html` in a browser — all 6 panels side by side (scaled to 28%).

| # | File hint | Headline |
|---|-----------|----------|
| 1 | `01-hero` | Stop losing stuff in the family chat. |
| 2 | `02-no-noise` | Just notes. No noise. |
| 3 | `03-pin-in-two-taps` | Pin it in two taps. |
| 4 | `04-dates` | Nobody shows up on Friday. |
| 5 | `05-tidies-itself` | The board tidies itself. |
| 6 | `06-invite` | One link. Everyone's in. |

## Export PNGs (1290 × 2796, 6.7")

Each `.shot` section is exactly **1290×2796** (App Store 6.7" size). Export:

```bash
npm i -D playwright   # one time — fetches Chromium
node store-screenshots/export.mjs
# → store-screenshots/out/01-hero-1290x2796.png … 06-invite-1290x2796.png
sips -g pixelWidth -g pixelHeight store-screenshots/out/*.png  # every file must read 1290 × 2796
```

## Device captures (live set — Guideline 2.3.3-proof)

`device-6.3/` holds five pure device screenshots (1206×2622, accepted
directly by the 6.1"/6.3" slot — no resize): board, welcome (email+guest
only), composer, note detail, switcher. Captured on a physical iPhone via
the TestFlight build. This is the set uploaded to App Store Connect; the
`out/` marketing panels stay as design backups.

## Real screenshots in the phone frames (mockup pipeline)

The frames can show your real app captures instead of the drawn mockups.
Save the 5 screenshots into `store-screenshots/assets/` — exact names, see
`assets/README.md` for the mapping:

`welcome.png` → panel 1 · `board.png` → panel 2 · `composer.png` → panel 3 ·
`note-detail.png` → panel 5 · `switcher.png` → panel 6
(panel 4 keeps the drawn date-tickets mockup — no dates capture yet).

Then re-run the export command above. If an asset file is missing, that panel
automatically falls back to its mockup — so a partial set still exports.

No-Chromium fallback: open `index.html` in Chrome, toggle device toolbar to
`1290 × 2796`, screenshot each `#shot-N` node (right-click → Capture node screenshot).

## Creative asset (product page header + search results)

One universal 16:9 PNG fills both App Store Connect slots
(Distribution → Product Page Information → Header and Search Results):

```bash
node store-screenshots/export-creative.mjs
# → store-screenshots/creative/universal-5244x2950.png (5244×2950, no alpha)
```

Scene: `creative.html` (mint door, four pinned notes, wordmark — brand
tokens from `src/theme/colors.ts`). Design canvas is 2622×1475, captured at
2x. Keep hero content centered: the header crops to 21:9 and search to 3:2.

Dedicated Search Results asset (3:2, max 3840×2560) — same notes reflowed,
extra pitch line:

```bash
node store-screenshots/export-search.mjs
# → store-screenshots/creative/search-3840x2560.png (3840×2560, no alpha)
```

Scene: `search.html` (design canvas 1920×1280, captured at 2x).

## Other sizes Apple asks for

- **6.1"** (1179×2556): App Store Connect's current phone slot. Downscaled
  from the 6.7" masters (aspect is near-identical, no re-layout):
  ```bash
  mkdir -p store-screenshots/out-6.1
  sips -z 2556 1179 store-screenshots/out/*.png --out store-screenshots/out-6.1/
  # → store-screenshots/out-6.1/01-hero-1179x2556.png … 06-invite-1179x2556.png
  ```
- **6.5"** (1242×2688, iPhone 11 Pro Max class): legacy size; only needed if
  Apple asks. Downscale the 6.7" PNGs the same way.
- **iPad 13"** (2064×2752): required by App Store Connect. Same panels
  and copy as the phone set, re-composed bezel-free (copy on top,
  full-width app UI below) — not a scaled-up phone frame. The iPad export
  deliberately uses the drawn mockups (real captures are phone-aspect
  device shots that can't fill the wide canvas cleanly):
  ```bash
  node store-screenshots/export-ipad.mjs
  # → store-screenshots/out-ipad/01-hero-2064x2752.png … 06-invite-2064x2752.png
  ```

## Editing copy or phone content

Edit `index.html` (markup) + `styles.css` (tokens). Keep headlines in Caveat 700,
body in Nunito — same fonts the app loads (`@expo-google-fonts/caveat`, `nunito`).
