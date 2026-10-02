#!/bin/sh
# Verify the public support address can actually receive mail.
# contact@fridge-board.kranehx.com (advertised on website/contact.html, the
# privacy policy, the link-site contact page, and the store listings) is
# received via Cloudflare Email Routing on the subdomain, which publishes
# MX records there and forwards to a monitored inbox. Until those MX
# records resolve, support, abuse and deletion requests cannot arrive.
#
# Usage: sh scripts/verify-support-email.sh [domain]
#   domain defaults to fridge-board.kranehx.com
set -eu

DOMAIN="${1:-fridge-board.kranehx.com}"
fail=0

if nslookup -type=MX "$DOMAIN" >/dev/null 2>&1; then
  mx="$(nslookup -type=MX "$DOMAIN" 2>/dev/null | sed -n 's/.*mail exchanger = //p' | head -3)"
  if [ -n "$mx" ]; then
    echo "ok   MX for $DOMAIN:"
    echo "$mx" | sed 's/^/       /'
  else
    echo "FAIL $DOMAIN has no MX records yet (Email Routing not enabled)"
    fail=1
  fi
else
  echo "FAIL $DOMAIN has no MX records (domain may not even be registered)"
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  cat >&2 <<'EOF'
Support-email verification FAILED.
Cloudflare Email Routing onboards root domains only, so the subdomain
needs its own receiver. Two free paths (see docs/store-listing.md §1):
  * NATIVE: add fridge-board.kranehx.com to Cloudflare as its own zone
    (NS delegation), then onboard Email Routing on that zone.
  * FASTEST: add the subdomain at ForwardEmail.net (free) and set its two
    MX records on the subdomain; mail forwards to your inbox.
Then send a test message from outside and confirm it arrives before
submitting store listings (both stores show this address publicly).
EOF
  exit 1
fi
echo "Support email OK: $DOMAIN accepts mail."
