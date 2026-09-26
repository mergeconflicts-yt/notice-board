// Generates the universal-link association files, the /j landing page, and
// the legal pages (Privacy / Terms / Contact) from environment variables, so
// no placeholder IDs ever ship. Run at deploy time (`node build.mjs`),
// output goes to ./public. The legal pages mirror website/{privacy,terms,
// contact}.html — keep both copies in sync when the copy changes.
//
// Required env:
//   APPLE_TEAM_ID     Apple Developer team id (e.g. A1B2C3D4E5)
//   ANDROID_SHA256    app signing SHA-256 fingerprint
//   APP_STORE_ID      numeric App Store id
// Optional:
//   IOS_BUNDLE_ID     default com.noticeboard.app
//   ANDROID_PACKAGE   default com.noticeboard.app
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'public');

const {
  APPLE_TEAM_ID,
  ANDROID_SHA256,
  APP_STORE_ID,
  IOS_BUNDLE_ID = 'com.noticeboard.app',
  ANDROID_PACKAGE = 'com.noticeboard.app',
} = process.env;

const missing = ['APPLE_TEAM_ID', 'ANDROID_SHA256', 'APP_STORE_ID'].filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing required env: ${missing.join(', ')}`);
  process.exit(1);
}

const aasa = {
  applinks: {
    apps: [],
    details: [{ appID: `${APPLE_TEAM_ID}.${IOS_BUNDLE_ID}`, paths: ['/j/*'] }],
  },
};

const assetlinks = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: ANDROID_PACKAGE,
      sha256_cert_fingerprints: [ANDROID_SHA256],
    },
  },
];

const jHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}" />
    <title>Join a Notice Board</title>
    <style>
      body { margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
             background:#FBF5E9; color:#3E362E; display:grid; place-items:center;
             min-height:100vh; text-align:center; padding:24px; }
      h1 { font-size:28px; margin:0 0 8px; } p { color:#6B6156; margin:0 0 24px; }
      a.btn { display:inline-block; background:#3E362E; color:#FBF5E9; text-decoration:none;
              padding:14px 28px; border-radius:999px; font-weight:700; }
      a.secondary { display:block; margin-top:16px; color:#6B6156; }
    </style>
  </head>
  <body>
    <main>
      <h1>You’re invited</h1>
      <p>Open this invite in the Notice Board app.</p>
      <a class="btn" id="open" href="#">Open in the app</a>
      <a class="secondary" href="https://apps.apple.com/app/id${APP_STORE_ID}">Get it on the App Store</a>
      <a class="secondary" href="https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}">Get it on Google Play</a>
    </main>
    <script>
      var parts = window.location.pathname.split('/').filter(Boolean);
      var token = parts[parts.length - 1] || '';
      var deepLink = 'noticeboard://j/' + encodeURIComponent(token);
      document.getElementById('open').href = deepLink;
      window.location.replace(deepLink);
    </script>
  </body>
</html>
`;

mkdirSync(join(out, '.well-known'), { recursive: true });
writeFileSync(join(out, '.well-known', 'apple-app-site-association'), JSON.stringify(aasa, null, 2) + '\n');
writeFileSync(join(out, '.well-known', 'assetlinks.json'), JSON.stringify(assetlinks, null, 2) + '\n');
writeFileSync(join(out, 'j.html'), jHtml);

// Legal pages: same copy as website/{privacy,terms,contact}.html, restyled
// for the standalone link site (no shared stylesheet here). Keep both copies
// in sync when the copy changes.
const legalStyle = `
body { margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
       background:#FBF5E9; color:#3E362E; line-height:1.6; }
main { max-width:720px; margin:0 auto; padding:48px 24px 96px; }
h1 { font-size:32px; margin:0 0 4px; } .updated { color:#6B6156; margin:0 0 32px; }
h2 { font-size:22px; margin:32px 0 8px; } p, li { margin-bottom:11px; }
ul { padding-left:22px; } a { color:#C05B4D; }
footer { text-align:center; padding:24px; color:#6B6156; font-size:14px; }
footer a { color:#6B6156; margin:0 8px; }
.mail { font-size:20px; font-weight:800; }`;
const legalPage = (title, updated, body) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} — Notice Board</title>
    <style>${legalStyle}</style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p class="updated">${updated}</p>
      ${body}
    </main>
    <footer><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="contact.html">Contact</a></footer>
  </body>
</html>
`;

const privacyBody = `
<h2>What Notice Board is</h2>
<p>Notice Board is a private, invite-only family board. There are no feeds, followers, ads or analytics SDKs. Your boards are visible only to people you invite.</p>
<h2>Data we collect</h2>
<ul>
<li><strong>Display name</strong> — you choose it; shown to people on your boards.</li>
<li><strong>Account identifiers</strong> — only if you save your account: an email address (email sign-in) or an Apple/Google identity. Guests use the app with no email at all.</li>
<li><strong>Board content</strong> — notes, lists, dates and photos you post. Photos are resized and re-encoded before upload, which strips location (EXIF/GPS) data.</li>
</ul>
<h2>What we don't collect</h2>
<p>No advertising identifiers, no location tracking, no contacts access, no behavioural analytics. There is nothing to opt out of because there is nothing to track.</p>
<h2>How your data is used</h2>
<p>Your data is used only to run the app: to show your boards to the people you invite, and to keep the service working. We never sell data, never show ads, and never share content with third parties except the infrastructure providers below.</p>
<h2>Processors</h2>
<ul>
<li><strong>Supabase</strong> — database, authentication and file storage.</li>
<li><strong>Apple / Google</strong> — only if you choose to save your account with them.</li>
<li><strong>Cloudflare Turnstile</strong> — bot protection on sign-in.</li>
</ul>
<h2>Retention</h2>
<ul>
<li>Notes leave after a week, photos after two weeks, dates the day after the event, lists two days after everything is ticked. Pinned posts stay until unpinned.</li>
<li>Removed posts stay restorable for 30 days, then are permanently deleted with their photos.</li>
<li>Orphaned uploads (photos never attached to a post) are deleted within 24 hours.</li>
</ul>
<h2>Deleting your account</h2>
<p>Delete your account any time from the app (You → Delete account). Signing out as a guest also deletes the guest account. Shared boards keep your posts, shown as “Former member”; fridges where you were the only person are removed. Guest accounts lost through uninstall or device loss are deleted after 90 days of inactivity (30 days if they never joined a board).</p>
<h2>Safety</h2>
<p>Any member can report a post to the board owner from the post screen. Board owners can remove posts, remove members, and block members so they cannot rejoin. To report abuse to us directly, see the <a href="contact.html">Contact</a> page.</p>
<h2>Your rights &amp; data requests</h2>
<p>To request a copy of your data, a correction, or deletion beyond the in-app controls, contact us via the <a href="contact.html">Contact</a> page. We respond within 30 days. Deletion requests follow the same rules as in-app deletion above.</p>
<h2>Children</h2>
<p>Notice Board is a family tool used under a household's supervision and is not directed at children under 13 on their own. If you believe a child has provided data without consent, contact us and we will delete it.</p>
<h2>Changes</h2>
<p>If this policy changes materially, we will update the date above and note it in the app before the change takes effect.</p>`;

const termsBody = `
<h2>The service</h2>
<p>Notice Board provides private, invite-only boards for families and small groups to share notes, lists, dates and photos. Boards are visible only to people with an invite link.</p>
<h2>Your account</h2>
<p>You may use the app as a guest with no account, or save your account with Apple, Google or email. Guest accounts live on the device: deleting the app or losing the phone can lose a guest account, so save it if your boards matter. You are responsible for who you share invite links with.</p>
<h2>Acceptable use</h2>
<p>Be kind on other people's fridges. You agree not to post content that is unlawful, harassing, hateful, sexually explicit involving minors, or that violates anyone's privacy or intellectual property — and not to misuse the service (spam, scraping, reverse-engineering, or interfering with other users' boards).</p>
<h2>Moderation &amp; safety</h2>
<p>Board owners can remove posts, remove members, and block members so they cannot rejoin. Any member can report a post to the board owner from the post screen. We may suspend or delete accounts and content that violate these terms, including in response to reports sent via the <a href="contact.html">Contact</a> page.</p>
<h2>Your content</h2>
<p>You keep ownership of what you post. By posting to a shared board you allow the people on that board to see it. Posts expire automatically (see the <a href="privacy.html">Privacy Policy</a> for lifetimes); removing a post keeps it restorable for 30 days before permanent deletion.</p>
<h2>Availability</h2>
<p>We aim to keep the service running but do not guarantee uninterrupted availability. Features may change as the app improves; material changes will be noted in the app.</p>
<h2>Termination</h2>
<p>You may stop using the service and delete your account at any time from the app. We may suspend or terminate accounts that breach these terms.</p>
<h2>Liability</h2>
<p>The service is provided “as is” without warranties of any kind. To the extent permitted by law, we are not liable for indirect or consequential losses arising from your use of the service.</p>
<h2>Contact</h2>
<p>Questions about these terms: see the <a href="contact.html">Contact</a> page.</p>`;

const contactBody = `
<p class="mail"><a href="mailto:support@noticeboard.app">support@noticeboard.app</a></p>
<h2>What to include</h2>
<ul>
<li><strong>Support</strong> — what happened, your device and app version, and (if relevant) the fridge name.</li>
<li><strong>Safety reports</strong> — the board name, what was posted, and when. You can also report a post to the board owner directly from the post screen in the app. We review safety reports within 48 hours.</li>
<li><strong>Data requests</strong> — the email or display name on the account plus what you need (a copy, a correction, or deletion). We respond within 30 days. See the <a href="privacy.html">Privacy Policy</a> for what deletion covers.</li>
</ul>
<h2>Response times</h2>
<p>Safety reports: within 48 hours. Everything else: within 5 working days.</p>`;

writeFileSync(join(out, 'privacy.html'), legalPage('Privacy Policy', 'Last updated: 26 September 2026', privacyBody));
writeFileSync(join(out, 'terms.html'), legalPage('Terms of Service', 'Last updated: 26 September 2026', termsBody));
writeFileSync(join(out, 'contact.html'), legalPage('Contact', 'We read everything.', contactBody));
console.log('Wrote public/{privacy,terms,contact}.html');
