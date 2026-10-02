// Unit tests for release-gated OAuth availability. iOS must not advertise a
// social provider until Sign in with Apple is available.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const BUILD = process.env.TEST_BUILD;
if (!BUILD) throw new Error('TEST_BUILD env var is required (see scripts/run-unit-tests.cjs)');
const {
  ProviderUnavailableError,
  assertOAuthProviderAvailable,
  availableOAuthProviders,
  isOAuthProviderAvailable,
} = require(`${BUILD}/lib/authProviders.js`);

describe('OAuth provider availability', () => {
  it('offers no social provider on iOS', () => {
    assert.deepEqual(availableOAuthProviders('ios'), []);
    assert.equal(isOAuthProviderAvailable('google', 'ios'), false);
  });

  it('keeps Google available off iOS', () => {
    assert.deepEqual(availableOAuthProviders('android'), ['google']);
    assert.equal(isOAuthProviderAvailable('google', 'android'), true);
  });

  it('rejects Google on iOS with release copy', () => {
    assert.throws(
      () => assertOAuthProviderAvailable('google', 'ios'),
      (error) =>
        error instanceof ProviderUnavailableError &&
        error.provider === 'google' &&
        error.platform === 'ios' &&
        /Sign in with Apple/.test(error.message),
    );
  });
});
