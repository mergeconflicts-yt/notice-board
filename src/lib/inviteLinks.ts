/**
 * Invite link/base URL config (docs/plan.md §11). The base URL is never
 * hard-coded — it comes from EXPO_PUBLIC_INVITE_BASE_URL, e.g.
 * `https://noticeboard-app.vercel.app`.
 */
export const INVITE_BASE_URL = process.env.EXPO_PUBLIC_INVITE_BASE_URL ?? '';

/** The web link a recipient can open to be routed into the app. */
export function inviteWebLink(token: string): string {
  return INVITE_BASE_URL ? `${INVITE_BASE_URL.replace(/\/$/, '')}/j/${token}` : token;
}

/** Message body for the React Native Share sheet. */
export function inviteMessage(boardName: string, token: string): string {
  return `Join “${boardName}” on Notice Board: ${inviteWebLink(token)}`;
}

/** Fallback code message (the short XXXXX-XXXXX code). */
export function inviteCodeMessage(boardName: string, code: string): string {
  return `Join “${boardName}” on Notice Board. Invite code: ${code}`;
}
