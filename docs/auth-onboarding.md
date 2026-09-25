Product behaviourFirst launch (no session, no identity marker) shows a Welcome screen:
1. Continue with Apple (iOS only)
2. Continue with Google
3. Continue with email → enter email → enter the 6-digit code from the email
4. Use as guest (secondary, text button) → one-line warning: "Your boards live on this phone only. If you delete the appor lose the phone, they're gone. You can save your account later."
Apple, Google and email create the account if it doesn't exist, or sign in if it does - one flow, no separate "sign up" vs
"sign in".
Guests work exactly as today (anonymous Supabase user). Profile shows "Save your account"→ Apple / Google / email.
Saving links the identity to the same user id, so every board stays.
Signed-up users can sign out safely and sign back in on any phone. Profile shows the email/provider and Sign out.
Invite link on a phone that has never used the app: show the board preview first (name, who invited you), then the same four options under a Join heading. Guest join is one tap, so invites stay low-friction.
Relaunch / lost session: unchanged - the identity marker still prevents silently becoming a new user. With no marker (fresh install), show Welcome.
Why these choices
• Email = 6-digit code, not magic link. No deep link, no PKCE verifier, works when the email is opened on a laptop, and avoids every redirect bug fixed during review. Supabase supports both from one signInWithotp call; the template decides which the user gets.
• Guest stays anonymous auth (not local-only data): boards are shared, so they must live on the server anyway. "Data
I
loss on uninstall" is really "loss of the key to that account" - the warning should say so plainly.
• Apple must be offered on iOS when Google is (App Store login-services rule). Guest mode also helps review: Apple doesn't want an account forced before people can try the app.


Changes:

1. src/store/session.ts
• New status 'welcome'. In runInit, the "no session, no marker" branch sets status: "welcome' instead of calling signInAnonymously. Nothing signs in automatically any more.
• New actions:
• continueAsGuest(captchaToken?) → signInAnonymously (captcha as today) → normal ready path.
• continueWithProvider(provider) → Auth sign-in (see 3).
• sendEmailCode(email, captchaToken) → signInWithotp(femail, options: {shouldCreateUser: true, captchaToken }}.
• verifyEmailCode(email, code) → verifyotp(f email, token: code, type: 'email' }).
• signout for a non-anonymous user → clear marker → welcome (not a new anonymous user). For a guest, keep today's destructive confirmation.
• startFresh → welcome instead of straight into a new guest.
2. New screens
• src/app/welcome.tsx - the four options. Rendered by SessionGate when status === "welcome' (like needsCaptcha today. The Turnstile widget moves here and is shown only for guest and email (Auth doesn't use captcha).
• src/app/email-code.tsx (or a second step inside welcome) - email field → "Send code" → 6 boxes, auto-submit on 6 digits, "Resend" after 30s, "Use a different email". Map errors: wrong/expired code, rate limited.
• Reuse the same email-code component for Profile → Save with email (see 4).
3. Apple and Google
• Keep the current browser OAth (signInWithAuth/ LinkIdentity +openAuthSessionAsync) for v1- it already works after the review fixes.
• Better later (smoother, required-feeling on iOS): native sheets via expo-apple-authentication and @react-native-google-signin/google-signin, then supabase.auth.signInWithIdToken(f provider, token, nonce }). Linking a guest natively needs linkIdentity with an id token (check the installed supabase-js supports it before switching).
• Prefill the display name from user. user_metadata. full_name / name on first sign-in (Apple only sends the name the first time - save it immediately).

4. Saving a guest account (Profile)
• Apple/Google → LinkIdentity (existing LinkProvider ).
• Email → updateUser({ email }), then verifyotp(f email, token, type: 'email_change' }) with the same code Ul. Replaces today's LinkEmail link-click flow.
• Conflict: if that Google/Apple/email already belongs to another account identity_already_exists /email_exists), show:
"That account already exists. Sign in to it instead? Boards you made as a guest on this phone won't come with you." → Sign in / Cancel. No merging in v1.
• After saving, the marker updates to isAnonymous: false (already handled by the auth listener).
5. Remove / change
• src/app/sign-in.tsx → replaced by Welcome (keep a route alias so old links don't 404).
• The "Already have an account? Sign in" link on the home screen → gone for signed-up users; for guests it becomes
"Save your account".
• Sessionate signedout state: offer Sign in (opens Welcome's provider/email options) and Use as guest.
• The "save your account" nudge (2nd board / 7 days) stays, guests only.
Backend changes
• handle_new_user (28260925000000_init.sql:188): set display_name from new.raw_user_meta_data-
»"full_name', then -> 'name', trimmed to 40 chars, falling back to "Someone'. Add a pTAP test.
• No schema change for guests vs accounts - auth.users. is_anonymous already tells them apart.
•cleanup-users already only deletes idle anonymous users with no boards - keep it; linked users are never touched.
• config.toml (local) and hosted dashboard:
• [auth.email] enable_signup = true, enable_confirmations = true, otp_length = 6, otp_expiry = 600-
• Email templates Magic Link and Confirm signup and Change email: include ff. Token }} (the code) - not only {f
•ConfirmationURL }}.
• [auth.external.apple] and [auth. external.google] enabled with client ids/secrets from env.
• Captcha on in production (signInAnonymously and signInWithotp both need the token).
• Custom SMTP in production - the built-in sender only allows a couple of emails an hour.
• Rate limits: [auth.rate_limit] email_sent sensible for launch (e.g. 30/h).



Tests
• PgTAP: handle_new_user picks up full_name / name, trims, falls back.
• Unit: session state machine - fresh install → welcome; guest sign-out → confirmation; account sign-out → welcome; marker present + no session → signedout.
• Device (production build):
1. Fresh install → Welcome; each of the four paths reaches the board.
2. Email: wrong code, expired code, resend, code opened on another device.
3. Guest → Save with Google/Apple/email → boards kept; reinstall → sign in → boards back.
4. Save with an identity that already has an account conflict dialog.
5. Invite link on a fresh install → preview → join as guest, and join with Google.
6. Signed-up user signs out → Welcome, not a new guest.
Store notes
• iOS: Sign in with Apple entitlement (ios.usesAppleSignIn: true in app.json) and an Apple Services ID for Supabase.
• Android: Google Auth client for the release SHA-1 (and the Play App Signing key).
• Privacy policy must now mention email addresses and Apple/Google identity data.