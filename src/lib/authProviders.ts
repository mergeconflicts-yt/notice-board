/**
 * OAuth availability by platform (pure; unit-tested).
 *
 * This release ships Google login only where it does not trigger Sign in with
 * Apple review requirements. In particular, iOS offers email and guest access
 * but no Google button until Sign in with Apple is configured. Apple remains
 * in the provider type for future work, but no current platform advertises it
 * because its dashboard credentials are not configured.
 */
export type OAuthProviderId = 'apple' | 'google';
export type AuthPlatform = 'ios' | 'android' | 'windows' | 'macos' | 'web';

export const GOOGLE_IOS_UNAVAILABLE_MESSAGE =
  'Google sign-in is paused on iPhone and iPad until Sign in with Apple is available. Please use email or continue as a guest.';

export class ProviderUnavailableError extends Error {
  readonly provider: OAuthProviderId;
  readonly platform: AuthPlatform;

  constructor(provider: OAuthProviderId, platform: AuthPlatform, message?: string) {
    super(message ?? GOOGLE_IOS_UNAVAILABLE_MESSAGE);
    this.name = 'ProviderUnavailableError';
    this.provider = provider;
    this.platform = platform;
  }
}

export function availableOAuthProviders(platform: AuthPlatform): OAuthProviderId[] {
  if (platform === 'ios') return [];
  return ['google'];
}

export function isOAuthProviderAvailable(
  provider: OAuthProviderId,
  platform: AuthPlatform,
): boolean {
  return availableOAuthProviders(platform).includes(provider);
}

export function assertOAuthProviderAvailable(
  provider: OAuthProviderId,
  platform: AuthPlatform,
): void {
  if (!isOAuthProviderAvailable(provider, platform)) {
    throw new ProviderUnavailableError(provider, platform);
  }
}
