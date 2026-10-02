#!/bin/sh
# Verify the public support address can actually receive mail.
# support@fridgeboard.app (advertised on website/contact.html, the privacy
# policy, the link-site contact page, and the store listings) needs the
# fridgeboard.app domain registered AND working inbound mail (MX records or
# an equivalent mail receiver). Until both resolve, support, abuse and
# deletion requests cannot arrive.
#
# Usage: sh scripts/verify-support-email.sh [domain]
#   domain defaults to fridgeboard.app
set -eu

DOMAIN="${1:-fridgeboard.app}"
fail=0

if nslookup -type=MX "$DOMAIN" >/dev/null 2>&1; then
  mx="$(nslookup -type=MX "$DOMAIN" 2>/dev/null | sed -n 's/.*mail exchanger = //p' | head -3)"
  if [ -n "$mx" ]; then
    echo "ok   MX for $DOMAIN:"
    echo "$mx" | sed 's/^/       /'
  else
    # Null MX (".") means the domain explicitly accepts no mail.
    echo "FAIL $DOMAIN resolves but advertises no mail receiver (null MX)"
    fail=1
  fi
else
  echo "FAIL $DOMAIN has no MX records (domain may not even be registered)"
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  cat >&2 <<'EOF'
Support-email verification FAILED.
To fix: register fridgeboard.app, then accept mail one of these ways —
  * a mailbox/forward at the registrar or Google Workspace/M365, or
  * free Cloudflare Email Routing on the domain to forward
    support@fridgeboard.app to a monitored inbox —
then send a test message from outside and confirm it arrives before
submitting store listings (both stores show this address publicly).
See docs/store-listing.md §1.
EOF
  exit 1
fi
echo "Support email OK: $DOMAIN accepts mail."
