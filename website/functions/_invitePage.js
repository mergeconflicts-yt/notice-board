// Shared invite-page HTML, served with HTTP 200 at the ORIGINAL /j/<token>
// URL by functions/j/[token].js and functions/j/index.js.
//
// Why a Function and not a `_redirects` rewrite: Cloudflare Pages resolves
// /j/<token> to the j.html file and then 308-redirects HTML pages to their
// extension-less counterpart (/j) BEFORE _redirects rewrites run — so no
// redirect file can ever serve j.html content at /j/*. A Function owns the
// route and bypasses static-route normalization entirely.
//
// Mirror of website/j.html (which can no longer be served at /j/* — direct
// /j.html requests 308 to /j and land here). Keep both in sync when the copy
// or store links change. The client script reads the token from
// location.pathname, which the Function preserves (200, no redirect).
export const INVITE_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="apple-itunes-app" content="app-id=0000000000" />
    <title>Join a Fridge Board</title>
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
      <p id="lead">Open this invite in the Fridge Board app.</p>
      <a class="btn" id="open" href="#" style="display:none">Open in the app</a>
      <a class="secondary" href="https://apps.apple.com/app/id0000000000">Get it on the App Store</a>
      <a class="secondary" href="https://play.google.com/store/apps/details?id=com.fridgeboard.app">Get it on Google Play</a>
    </main>
    <script>
      (function () {
        // Read the token from …/j/<token>. Never take the bare route segment:
        // if a redirect ever strips the token, parts is just ['j'] and the old
        // code built a bogus fridgeboard://j/j. Fall back to ?t=/?token= so a
        // query-preserving host still works.
        function tokenFromLocation() {
          var parts = window.location.pathname.split('/').filter(Boolean);
          for (var i = 0; i < parts.length - 1; i++) {
            if (parts[i] === 'j') return parts[i + 1];
          }
          var params = new URLSearchParams(window.location.search);
          return params.get('t') || params.get('token') || '';
        }

        var token = tokenFromLocation();
        var lead = document.getElementById('lead');
        var open = document.getElementById('open');

        // Invite tokens are opaque but never 1–5 chars; reject the empty or
        // truncated case instead of routing to a broken invite.
        if (!/^[A-Za-z0-9_-]{6,}$/.test(token)) {
          lead.textContent = 'This invite link isn’t working. Ask for a fresh link.';
          return;
        }

        var deepLink = 'fridgeboard://j/' + encodeURIComponent(token);
        open.href = deepLink;
        open.style.display = 'inline-block';
        window.location.replace(deepLink);
      })();
    </script>
  </body>
</html>
`;
