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

`flows-prod/` holds the signed-build suite (`_launch.yaml` launch plus
`_guest` / `_board` / `_teardown` helpers). Maestro flow headers cannot read
env vars, so `appId` is fixed per directory: keep Expo Go flows in `flows/`
and prod flows in `flows-prod/`.

| Prod flow | Journey (needs `npm run build:prod` + real device) |
| --- | --- |
| `smoke` | Welcome → guest name → home |
| `email-auth` | Welcome → email step → code send → "Check your email" (human redeems the inbox code; Turnstile may challenge) |
| `photo-composer` | photo tab UI + caption field (human picks a real photo in the system picker; permission dialog + library have no stable selectors) |
| `invite-code` | owner copies invite code → fresh guest pastes it → joins → leaves |
| `invalid-code` | bogus code shows the invalid-code error |
| `coldstart-invite` | `fridgeboard://j/<token>` from fresh state lands on the invite landing (https variant waits for the link-site fix + a rebuilt IPA/AAB) |
| `relaunch` | post note → kill → relaunch → note persists (lock the phone mid-step for the full backgrounding check) |
| `guest-signout` | guest sign-out deletes the guest account → back at Welcome, boards gone |
| `account-deletion` | profile → Delete account → confirm → back at Welcome |

## What is covered

| Flow | Journey |
| --- | --- |
| `guest-create-delete` | welcome → guest name → home → create fridge → delete fridge |
| `note` / `list` / `date` | composer tabs → post appears on board → Edit round-trip verifies saved type + content |
| `keep` | Keep taps on a note never dead-end, no crash |
| `join-invite` | owner copies invite code → fresh guest pastes it → joins → leaves |
| `join-invalid-code` | bogus code shows the invalid-code error |
| `photo-composer` | photo tab UI + caption field (see below) |
| `settings-people` | switcher → settings → people list |
| `profile` | identity, sign-out/delete rows |

## Deliberate gaps

- **Rendered card content is not asserted directly** (note/list/date/keep): the
  handwriting glyphs in transformed note cards are invisible to Maestro's
  iOS text channel — exact text, regex, and even the card's single-line
  `accessibilityLabel` all fail to match (verified 2026-10-02), while
  `testID`s match fine. Flows sync on `note-card` (proving the post landed
  and rendered), then verify saved type + content through the Edit round-trip:
  the edit sheet reuses the composer `TextInput`s (`note-field`,
  `list-title-field`, `date-title-field`), whose text IS matchable (same
  mechanism as the caption assert in `photo-composer.yaml`). A wrong saved
  type shows no matching field; dropped content fails the text assert. The
  data layer is additionally covered by pgTAP
  `supabase/tests/03_items.test.sql` (body/title round-trips through the
  RPCs).

- **Photo upload through the system picker** is not automated: the iOS photo
  permission alert and library grid have no stable selectors. The composer UI
  is locked by `photo-composer`; the server upload path was verified
  end-to-end during development.
- **Google/email sign-in** (human/captcha gated) stays manual — guest signup
  stands in for auth in every flow. Google is shown only off iOS in this
  release; Apple is not shipped at all (no Apple Developer account; buttons +
  entitlement removed).
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
  row), `action-keep` / `action-remove` / `action-edit` (note detail buttons), `edit-cancel` (edit sheet),
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
