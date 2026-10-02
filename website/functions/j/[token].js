// Serves the invite fallback with HTTP 200 AT /j/<token> (token preserved).
// _headers does not apply to Function responses, so the /j/* header rules
// (noindex, no-referrer) are set here explicitly.
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
