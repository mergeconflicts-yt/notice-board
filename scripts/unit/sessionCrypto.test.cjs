// Unit tests for the encrypted session store's pure helpers.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const BUILD = process.env.TEST_BUILD;
if (!BUILD) throw new Error('TEST_BUILD env var is required (see scripts/run-unit-tests.cjs)');
const { encryptJson, decryptJson, isJson } = require(`${BUILD}/lib/sessionCrypto.js`);

const key = new Uint8Array(32).fill(7);
const iv = new Uint8Array(16).fill(1);

describe('sessionCrypto', () => {
  it('round-trips a JSON object (the session)', () => {
    const value = JSON.stringify({ access_token: 'a.b.c', refresh_token: 'r' });
    assert.equal(decryptJson(key, encryptJson(key, value, iv)), value);
  });

  it('round-trips a JSON string (the PKCE code verifier)', () => {
    // auth-js stores the verifier as JSON.stringify("…") — a leading quote.
    const value = JSON.stringify('abc-123-verifier');
    assert.equal(decryptJson(key, encryptJson(key, value, iv)), value);
  });

  it('accepts any JSON value, not just objects/arrays', () => {
    assert.equal(isJson('"verifier"'), true);
    assert.equal(isJson('{"a":1}'), true);
    assert.equal(isJson('not json'), false);
  });

  it('rejects malformed or non-JSON ciphertext', () => {
    assert.equal(decryptJson(key, 'zzzz'), null);
    assert.equal(decryptJson(key, ''), null);
  });
});
