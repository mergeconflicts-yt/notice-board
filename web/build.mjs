// Generates the universal-link association files and the /j landing page from
// environment variables, so no placeholder IDs ever ship. Run at deploy time
// (`node build.mjs`), output goes to ./public.
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
console.log('Wrote public/.well-known/{apple-app-site-association,assetlinks.json} and public/j.html');
