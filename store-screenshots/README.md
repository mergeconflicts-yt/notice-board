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

## Real screenshots in the phone frames (recommended)

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

## Other sizes Apple asks for

- **6.5"** (1242×2688, iPhone 11 Pro Max class): downscale the 6.7" PNGs in Preview/SIP — no re-layout needed, aspect is near-identical.
- **iPad 13"** (2064×2752): optional; current panels are portrait-phone-first. If needed, re-export with `.shot { width:2064px; height:2752px }` and widen `.copy` / `.phone`.

## Editing copy or phone content

Edit `index.html` (markup) + `styles.css` (tokens). Keep headlines in Caveat 700,
body in Nunito — same fonts the app loads (`@expo-google-fonts/caveat`, `nunito`).
