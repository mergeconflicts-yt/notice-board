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
