// Google Search Console HTML-file verification.
//
// Cloudflare Pages 308-redirects `*.html` to the extension-less URL *before*
// `_redirects` rewrites run (see website/_redirects), so the static file at
// `website/googlee989c2dd8394c1da.html` can never be fetched at the exact URL
// Google checks. Like the /j fallback, a Function wins over that redirect and
// serves the token with HTTP 200 at the original path.
//
// Keep this while the property is verified in Search Console; removing it
// un-verifies the property on the next check.
const BODY = "google-site-verification: googlee989c2dd8394c1da.html";

export const onRequest = () =>
  new Response(BODY, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      "x-content-type-options": "nosniff",
    },
  });
