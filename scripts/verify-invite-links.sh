#!/bin/sh
# Verify the invite-link fallback serves at the ORIGINAL /j/<token> URL.
# Fails if a Cloudflare dashboard Redirect Rule is still shadowing the
# Pages `_redirects` rewrite (307 to /j drops the token and breaks
# cold-start joining) or if the association files are missing.
#
# Usage: sh scripts/verify-invite-links.sh [base-url]
#   base-url defaults to https://fridge-board.kranehx.com
set -eu

BASE="${1:-https://fridge-board.kranehx.com}"
TOKEN="test-token"
fail=0

check() {
  desc="$1"; url="$2"; want="$3"
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$url")"
  loc="$(curl -sS -D - -o /dev/null --max-time 20 "$url" | tr -d '\r' | sed -n 's/^location: //ip' | head -1)"
  if [ "$code" = "$want" ]; then
    echo "ok   $desc -> $code"
  else
    echo "FAIL $desc -> $code (location: ${loc:-none}; want $want)"
    fail=1
  fi
  case "$desc" in
    "invite link keeps token"*)
      case "$loc" in
        ""|"/j/test-token"*|*"j/test-token"*) ;;
        *) echo "FAIL invite link redirects away from the token (location: $loc)"; fail=1;;
      esac
      ;;
  esac
}

# The rewrite must serve j.html AT /j/<token> (200), never 30x to /j.
check "invite link keeps token" "$BASE/j/$TOKEN" "200"
# Association files must exist for universal links / app links.
check "apple association" "$BASE/.well-known/apple-app-site-association" "200"
check "android assetlinks" "$BASE/.well-known/assetlinks.json" "200"

if [ "$fail" -ne 0 ]; then
  cat >&2 <<'EOF'
Invite-link verification FAILED.
If /j/<token> 307s to /j (even /j.html itself redirects), a Cloudflare
dashboard Redirect Rule such as "/j* -> /j" is shadowing website/_redirects
(Pages _redirects cannot redirect /j.html to /j — only a dashboard rule can).
Remove or narrow that dashboard rule to leave /j/* alone, then re-run this
script. Association 404s mean web/build.mjs has not been run with
APPLE_TEAM_ID / ANDROID_SHA256 / APP_STORE_ID (needs a paid Apple account).
EOF
  exit 1
fi
echo "Invite links OK: token preserved, association files present."
