// Unit tests for the email-code helpers: validation, code completeness,
// resend timing constant, and OTP error copy.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const BUILD = process.env.TEST_BUILD;
if (!BUILD) throw new Error('TEST_BUILD env var is required (see scripts/run-unit-tests.cjs)');
const {
  EMAIL_CODE_LENGTH,
  EMAIL_RESEND_SECONDS,
  normalizeEmail,
  isEmailValid,
  isCodeComplete,
  mapOtpError,
} = require(`${BUILD}/utils/emailCode.js`);

describe('email validation', () => {
  it('normalizes case and whitespace', () => {
    assert.equal(normalizeEmail('  Ada@Example.COM '), 'ada@example.com');
  });

  it('accepts plausible addresses and rejects junk', () => {
    assert.equal(isEmailValid('ada@example.com'), true);
    assert.equal(isEmailValid('not-an-email'), false);
    assert.equal(isEmailValid('a@b'), false);
    assert.equal(isEmailValid(''), false);
  });
});

describe('code completeness', () => {
  it('needs exactly six digits', () => {
    assert.equal(EMAIL_CODE_LENGTH, 6);
    assert.equal(isCodeComplete(['1', '2', '3', '4', '5', '6']), true);
    assert.equal(isCodeComplete(['1', '2', '3', '4', '5']), false);
    assert.equal(isCodeComplete(['1', '2', '3', '4', '5', 'x']), false);
    assert.equal(isCodeComplete(['1', '2', '3', '4', '5', '']), false);
  });

  it('waits 30s before resending', () => {
    assert.equal(EMAIL_RESEND_SECONDS, 30);
  });
});

describe('otp error copy', () => {
  it('treats the combined expired-or-invalid message as expired', () => {
    assert.equal(
      mapOtpError({ message: 'Token has expired or is invalid' }),
      'That code expired. Send a new one and try again.',
    );
  });

  it('maps mismatches, rate limits, and the unknown fallback', () => {
    assert.equal(
      mapOtpError({ message: 'invalid token' }),
      'That code doesn’t match — check the email and try again.',
    );
    assert.equal(
      mapOtpError({ status: 429, message: 'rate limit' }),
      'Too many tries. Wait a moment, then resend a fresh code.',
    );
    assert.equal(mapOtpError(new Error('boom')), 'Something went wrong. Please try again.');
  });
});
