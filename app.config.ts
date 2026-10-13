import type { ConfigContext, ExpoConfig } from 'expo/config';
import appJson from './app.json';

/**
 * Derives universal-link config from EXPO_PUBLIC_INVITE_BASE_URL so the app
 * never hard-codes a domain (docs/plan.md §11). Without a base URL, the app
 * still runs; only the https:// app-link filters are omitted.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const base = appJson.expo as unknown as ExpoConfig;
  const inviteBase = process.env.EXPO_PUBLIC_INVITE_BASE_URL ?? '';
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  // NOTE: Turnstile captcha is stood down (see docs/hosted-setup.md): the
  // EXPO_PUBLIC_TURNSTILE_SITE_KEY env var is intentionally NOT required
  // here, so production builds sign in without a captcha. To re-enable,
  // re-add the `turnstileSiteKey` read + `missing.push` check below.

  // A production build must know its public origin: universal links depend
  // on it, and a silent empty value would ship a broken invite flow.
  // Supabase credentials are equally load-bearing — without them the app
  // cannot sign in — so fail the build rather than shipping a build that
  // can only fail at runtime.
  const isProdBuild =
    process.env.EAS_BUILD === 'true' && process.env.EAS_BUILD_PROFILE === 'production';
  if (isProdBuild) {
    const missing: string[] = [];
    if (!inviteBase || !/^https:\/\/[^/]+/i.test(inviteBase)) {
      missing.push('EXPO_PUBLIC_INVITE_BASE_URL (must be an https:// URL)');
    }
    if (!supabaseUrl) missing.push('EXPO_PUBLIC_SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
    if (missing.length > 0) {
      throw new Error(
        `Missing required production config: ${missing.join(', ')}. ` +
          'See docs/infrastructure.md.',
      );
    }
  }

  let host = '';
  try {
    if (inviteBase) host = new URL(inviteBase).host;
  } catch {
    host = '';
  }

  return {
    ...config,
    ...base,
    ios: {
      ...base.ios,
      ...(host ? { associatedDomains: [`applinks:${host}`] } : {}),
    },
    android: {
      ...base.android,
      ...(host
        ? {
            intentFilters: [
              {
                action: 'VIEW',
                autoVerify: true,
                data: [{ scheme: 'https', host, pathPrefix: '/j/' }],
                category: ['BROWSABLE', 'DEFAULT'],
              },
            ],
          }
        : {}),
    },
  };
};
