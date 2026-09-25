/** Shared email-code flow helpers (pure; unit-tested). Used by the Welcome
 *  sign-in/up flow and the Profile save-with-email flow. */
export const EMAIL_CODE_LENGTH = 6;
export const EMAIL_RESEND_SECONDS = 30;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isEmailValid(email: string): boolean {
  return /.+@.+\..+/.test(email);
}

export function isCodeComplete(digits: string[]): boolean {
  return digits.length === EMAIL_CODE_LENGTH && digits.every((d) => /^\d$/.test(d));
}

/** Plain-English copy for OTP failures. Supabase's expired message also
 *  contains the word "invalid", so the expired check comes first. */
export function mapOtpError(error: unknown): string {
  const status = (error as { status?: number })?.status;
  if (status === 429) return 'Too many tries. Wait a moment, then resend a fresh code.';
  const message = String((error as { message?: string })?.message ?? '');
  if (/expir/i.test(message)) return 'That code expired. Send a new one and try again.';
  if (/invalid|incorrect|mismatch|wrong/i.test(message)) {
    return 'That code doesn’t match — check the email and try again.';
  }
  if (/rate|limit|too many/i.test(message)) {
    return 'Too many tries. Wait a moment, then resend a fresh code.';
  }
  return 'Something went wrong. Please try again.';
}
