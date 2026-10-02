# Screenshot assets — real app captures for the phone frames

Save the 5 screenshots from the chat here with **exactly** these names:

| File | Which image | Used in |
|------|-------------|---------|
| `board.png` | Full board (Wi-Fi, Trash, Groceries, Dentist, Grandma, Thailand photo) | Panel 2 · No noise |
| `welcome.png` | Welcome screen ("None of the noise") | Panel 1 · Hero |
| `composer.png` | Add-to-fridge composer ("Dinner is in the fridge" + keyboard) | Panel 3 · Pin it in two taps |
| `note-detail.png` | Note popup ("Grandma visits Saturday", "Leaves the board" pill) | Panel 5 · Tidies itself |
| `switcher.png` | "Your fridges" switcher sheet | Panel 6 · Invite |

Panel 4 (Dates) has no dedicated capture, so it keeps the drawn date-tickets
mockup — send a dates-focused screenshot later to swap it too.

Then regenerate:

```bash
npm i -D playwright   # one time
node store-screenshots/export.mjs
# → store-screenshots/out/*.png
```

Tip: capture at iPhone 16 Pro / 15 Pro resolution (1206×2622 or 1290×2796)
with the status bar visible — the frame crops with `object-fit: cover`.

## Release-matching rule (blocking)

Captures must show only login options the release build offers. A capture
showing a removed provider (e.g. Apple login, which is not shipped — see
`src/lib/authProviders.ts`) is a store-review hazard and must be
quarantined to `assets/stale/`, never exported. Capture `welcome.png` from
the release build (iOS: email + guest only). See `docs/store-listing.md` §4.
