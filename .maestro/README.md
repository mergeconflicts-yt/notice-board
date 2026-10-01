# End-to-end tests (Maestro)

UI journeys against the **local** stack: Metro (`npx expo start`), local
Supabase (`supabase start`, incl. `supabase functions serve`), Expo Go on a
booted iOS Simulator. Each flow is hermetic: it signs up a fresh guest
(`clearState`), creates its own `E2E Fridge`, and deletes it at the end, so
flows run in any order and rerun cleanly.

## Prerequisites

1. Maestro CLI: `brew install maestro` (then `maestro --version`).
2. Booted Simulator: `xcrun simctl boot "iPhone 17 Pro"` (any device works).
3. From the repo root:
   - `supabase start` (DB + edge functions for photo upload)
   - `npx expo start` (keep it running; flows open `exp://127.0.0.1:8081`,
     which reaches the Mac from the Simulator)

## Run

```bash
npm run test:e2e          # all flows
maestro test .maestro/flows/note.yaml   # one flow
```

`flows/` holds the suites; `helpers/` (`_`-prefixed) holds shared
setup/teardown and never runs standalone.

## Production builds (real device / device farm)

The suite above runs in **Expo Go**. A real release needs the signed app
(`com.fridgeboard.app`), a different launch (`launchApp`, no `exp://`, no dev
menu), and real external auth/photo flows. That lives in `flows-prod/`:

```bash
npm run test:e2e:prod   # maestro --config .maestro/config.prod.yaml .maestro/flows-prod
```

`flows-prod/` currently has `_launch.yaml` (signed-build launch) and
`smoke.yaml` (Welcome → guest → home). Add the device-only journeys — external
Google/email auth, real photo picking, backgrounding, sign-out/account deletion
— beside them. Maestro flow headers cannot read env vars, so `appId` is fixed
per directory: keep Expo Go flows in `flows/` and prod flows in `flows-prod/`.

## What is covered

| Flow | Journey |
| --- | --- |
| `guest-create-delete` | welcome → guest name → home → create fridge → delete fridge |
| `note` / `list` / `date` | composer tabs → post appears on board |
| `keep` | Keep taps on a note never dead-end, no crash |
| `join-invite` | owner copies invite code → fresh guest pastes it → joins → leaves |
| `join-invalid-code` | bogus code shows the invalid-code error |
| `photo-composer` | photo tab UI + caption field (see below) |
| `settings-people` | switcher → settings → people list |
| `profile` | identity, sign-out/delete rows |

## Deliberate gaps

- **Photo upload through the system picker** is not automated: the iOS photo
  permission alert and library grid have no stable selectors. The composer UI
  is locked by `photo-composer`; the server upload path was verified
  end-to-end during development.
- **Google/email sign-in** (human/captcha gated) stays manual — guest signup
  stands in for auth in every flow. Apple is not shipped this release (no
  Apple Developer account; buttons + entitlement removed).
- `join-invite` leaves the owner's emptied board behind (the joiner leaves,
  only owners can delete). Local nightly cleanup jobs remove the debris;
  reruns are unaffected since every flow uses fixed names on fresh guests.
- `flows/` targets iOS Simulator + Expo Go. For signed builds use `flows-prod/`
  (`npm run test:e2e:prod`); EAS device-farm/cloud wiring is still a future
  step — build the IPA/AAB first (`npm run build:prod`), then run the prod
  flows on a device or upload them to Maestro cloud.

## Selectors

Flows prefer visible text. `testID`s exist wherever text is dynamic,
ambiguous, or shares its row with icons/other text (Maestro matches exact
element text): `back` (headers), `switch-fridges` (board badge), `pick-date` /
`pick-time` (composer triggers), `invite-code` (code card), `tab-note` /
`tab-photo` / `tab-list` / `tab-date` (composer tabs), `row-people` (settings
row), `action-keep` / `action-remove` (note detail buttons),
`wheel-Hour-*` / `wheel-Minute-*` (time wheels), `today-btn`, `dt-done`,
plus `*-field` ids on every text input (placeholders are unreliable
selectors).

## Harness lessons (iOS + Expo Go)

- Fresh Expo Go auto-opens its dev menu over the project: every launch
  dismisses it via the `xmark` id first.
- Never use `hideKeyboard`: on this app it lands on "Go back" and leaves the
  flow. Maestro auto-scrolls fields and buttons inside scroll views instead.
- `retryTapIfNoChange: true` on every navigation tap: taps that commit
  navigation instantly can otherwise report failure after succeeding.
- Assert exact rendered text: `textTransform: uppercase` titles match only in
  capitals, and icon+text rows expose composed labels — prefer `testID`s.
