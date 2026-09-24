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

/** The single Supabase client for the whole app (docs/plan.md §8.1). */
export const supabase = createClient<Database>(url, anonKey, {
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
