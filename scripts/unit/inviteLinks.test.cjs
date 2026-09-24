// Unit tests for invite-input parsing (tokens are case-sensitive; codes are
// normalized server-side, so the client must not alter what the user typed).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const BUILD = process.env.TEST_BUILD;
if (!BUILD) throw new Error('TEST_BUILD env var is required (see scripts/run-unit-tests.cjs)');
const { parseInviteInput } = require(`${BUILD}/utils/invite.js`);

describe('parseInviteInput', () => {
  it('extracts a token from an https link', () => {
    assert.equal(parseInviteInput('https://notice.app/j/LPC42Kpp0VmFFIPFg8Yh3Q'), 'LPC42Kpp0VmFFIPFg8Yh3Q');
  });

  it('extracts a token from a custom-scheme link', () => {
    assert.equal(parseInviteInput('noticeboard://j/AB_C-d1'), 'AB_C-d1');
  });

  it('pulls the code out of the share message', () => {
    assert.equal(
      parseInviteInput('Join “Kranti” on Notice Board. Invite code: ABCDE-FGHIJ'),
      'ABCDE-FGHIJ',
    );
  });

  it('pulls a trailing token out of a share message', () => {
    assert.equal(
      parseInviteInput('Join “Kranti” on Notice Board: LPC42Kpp0VmFFIPFg8Yh3Q'),
      'LPC42Kpp0VmFFIPFg8Yh3Q',
    );
  });

  it('leaves a bare code/token untouched (no uppercasing or stripping)', () => {
    assert.equal(parseInviteInput('abcde-fghij'), 'abcde-fghij');
    assert.equal(parseInviteInput('LPC42Kpp0VmFFIPFg8Yh3Q'), 'LPC42Kpp0VmFFIPFg8Yh3Q');
  });

  it('returns empty for blank input', () => {
    assert.equal(parseInviteInput('   '), '');
  });
});
