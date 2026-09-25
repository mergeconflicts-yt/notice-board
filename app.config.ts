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

  // A production build must know its public origin: universal links and the
  // Turnstile page origin both depend on it, and a silent empty value would
  // ship a broken invite/captcha flow.
  const isProdBuild =
    process.env.EAS_BUILD === 'true' && process.env.EAS_BUILD_PROFILE === 'production';
  if (isProdBuild) {
    if (!inviteBase) {
      throw new Error('EXPO_PUBLIC_INVITE_BASE_URL is required for a production build.');
    }
    if (!/^https:\/\/[^/]+/i.test(inviteBase)) {
      throw new Error('EXPO_PUBLIC_INVITE_BASE_URL must be an https:// URL.');
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
