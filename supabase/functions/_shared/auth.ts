/**
 * Shared request auth for the service-role Edge Functions. The scheduled jobs
 * are invoked by pg_net with a dedicated Vault secret (`job_secret`), which is
 * sent as a bearer token. Fall back to the service-role key only when no
 * dedicated secret is configured (local dev).
 */

/** Constant-time string compare — never leak the token via response timing. */
export function safeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

export function authorized(req: Request): boolean {
  const expected = Deno.env.get('JOB_SECRET') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!expected) return false;
  const auth = req.headers.get('Authorization') ?? '';
  return safeEqual(auth, `Bearer ${expected}`);
}
