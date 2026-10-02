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
To fix (Cloudflare dashboard): onboard kranehx.com at Email Routing, add +
verify the destination inbox, then open the domain → Settings →
Subdomains → add fridge-board.kranehx.com (Cloudflare publishes the
subdomain MX itself). Then Routing Rules → rule for `contact` on the
subdomain. If a receiver asks for an SPF TXT, merge it into ONE record
with Resend's (v=spf1 include:amazonses.com …), never two.
Then send a test message from outside and confirm it arrives before
submitting store listings (both stores show this address publicly).
See docs/store-listing.md §1.
EOF
  exit 1
fi
echo "Support email OK: $DOMAIN accepts mail."
