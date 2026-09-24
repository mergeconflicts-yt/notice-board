// Unit tests for note variant selection: the chosen kind wins, the text is
// never second-guessed into another style.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const BUILD = process.env.TEST_BUILD;
if (!BUILD) throw new Error('TEST_BUILD env var is required (see scripts/run-unit-tests.cjs)');
const { pinVariantForNote } = require(`${BUILD}/utils/note.js`);

const v = (text, kind, extra = {}) =>
  pinVariantForNote({ text, imageUrl: null, kind, expiresAt: null, ...extra });

describe('pinVariantForNote', () => {
  it('keeps a plain note a note even when the text looks list-like', () => {
    assert.equal(v('Milk\nEggs\nBread', 'note'), 'note');
    assert.equal(v('- Milk\n- Eggs', 'note'), 'note');
  });

  it('never guesses receipt style for a plain note', () => {
    // Short single-line texts still get the size-based mini style — just
    // never the receipt style the words suggest.
    assert.equal(v('wifi password: abc123', 'note'), 'mini');
    assert.equal(v('$5 lunch', 'note'), 'mini');
    assert.equal(
      v('wifi password for the office, ask at the front desk please', 'note'),
      'note',
    );
  });

  it('never guesses appointment style for a plain note', () => {
    assert.equal(v('Dentist tomorrow 3pm', 'note'), 'mini');
    assert.equal(
      v('Dentist appointment tomorrow at 3pm, bring the referral letter', 'note'),
      'note',
    );
  });

  it('still applies size-based styles to plain notes', () => {
    assert.equal(v('hello', 'note'), 'mini');
    assert.equal(v('a'.repeat(120), 'note'), 'announcement');
  });

  it('honours explicitly chosen kinds', () => {
    assert.equal(v('just some words', 'list'), 'list');
    assert.equal(v('just some words', 'appointment'), 'appointment');
    assert.equal(
      v('caption', 'photo', { imageUrl: null }),
      'photo',
    );
  });

  it('keeps legacy guessing for unknown kinds', () => {
    assert.equal(v('- Milk\n- Eggs', ''), 'list');
    assert.equal(v('wifi password: abc123', ''), 'receipt');
  });
});
