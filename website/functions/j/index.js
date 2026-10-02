// Bare /j (no token — e.g. after /j.html's platform 308 lands here) serves
// the same page with HTTP 200; its script shows the "ask for a fresh link"
// state since there is no token to join with.
import { INVITE_PAGE } from '../_invitePage.js';

export function onRequestGet() {
  return new Response(INVITE_PAGE, {
    status: 200,
    headers: {
      'content-type': 'text/html;charset=UTF-8',
      'x-robots-tag': 'noindex, nofollow',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    },
  });
}
