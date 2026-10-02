#!/bin/sh
# Verify the invite-link fallback serves at the ORIGINAL /j/<token> URL.
# /j/* is owned by Pages Functions (website/functions/j/), because Pages
# 308-redirects HTML pages to extension-less URLs before _redirects rewrites
# run — so a rewrite to j.html could never fire. A 30x here means either a
# Cloudflare dashboard rule (Redirect/Page/Bulk) or a Worker route (e.g. the
# legacy notice-board Worker) is grabbing /j/* before Pages, or the
# functions/ deploy is stale/missing.
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
If /j/<token> 30x to /j (even /j.html itself redirects), something in front
of Pages is eating the token: a dashboard Redirect/Page/Bulk rule matching
/j*, or a Worker route (e.g. the legacy notice-board Worker) shadowing the
domain. The repo side is a Pages Function (website/functions/j/), which is
the only thing that survives Pages' own HTML extension-stripping — a plain
_redirects rewrite to j.html can never work there. Association 404s mean
web/build.mjs has not been run with APPLE_TEAM_ID / ANDROID_SHA256 /
APP_STORE_ID (needs a paid Apple account).
EOF
  exit 1
fi
echo "Invite links OK: token preserved, association files present."
