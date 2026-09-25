import { createClient } from '@supabase/supabase-js';
import { LargeSecureStore } from './secureStore';
import type { Database } from './database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (see docs/infrastructure.md).',
  );
}

/**
 * GoTrue only treats 500/501/502/503/504 (and a few Cloudflare codes) as
 * temporary: any other status — including a 429 from a rate-limited token
 * refresh — is treated as a permanent failure and the stored session is
 * deleted. Present a 429 on the token endpoint as a 503 so the refresh is
 * retried and the session is kept.
 */
const authFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.status !== 429) return response;
  const url =
    typeof input === 'string'
      ? input
      : input instanceof Request
        ? input.url
        : String(input);
  if (!url.includes('/token')) return response;
  return new Response(response.body, {
    status: 503,
    statusText: 'Service Unavailable',
    headers: response.headers,
  });
};

/** The single Supabase client for the whole app (docs/plan.md §8.1). */
export const supabase = createClient<Database>(url, anonKey, {
  global: { fetch: authFetch },
  auth: {
    storage: LargeSecureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE is required for `linkIdentity`/OAuth in a native app.
    flowType: 'pkce',
  },
});

/** Turnstile site key; when absent, anonymous sign-in runs without a captcha (local dev). */
export const turnstileSiteKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY;
