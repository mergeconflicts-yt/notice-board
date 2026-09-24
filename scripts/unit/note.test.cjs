// Unit tests for the note helpers: the chosen type drives the paper style,
// and the small parsers/labels behave.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const BUILD = process.env.TEST_BUILD;
if (!BUILD) throw new Error('TEST_BUILD env var is required (see scripts/run-unit-tests.cjs)');
const {
  paperVariantFor,
  parseListItems,
  keepUntilLabel,
  colorForItem,
  rotationForItem,
} = require(`${BUILD}/utils/note.js`);

describe('paperVariantFor', () => {
  it('maps the chosen type to its paper, never guessing from text', () => {
    assert.equal(paperVariantFor('note'), 'note');
    assert.equal(paperVariantFor('list'), 'list');
    assert.equal(paperVariantFor('date'), 'appointment');
    assert.equal(paperVariantFor('photo'), 'photo');
  });
});

describe('parseListItems', () => {
  it('parses marked rows with a title', () => {
    assert.deepEqual(parseListItems('Shop\n- Milk\n- Eggs'), {
      title: 'Shop',
      items: [
        { text: 'Milk', done: false },
        { text: 'Eggs', done: false },
      ],
    });
  });

  it('reads done markers', () => {
    const parsed = parseListItems('[x] Done\n☐ Todo');
    assert.deepEqual(parsed.items, [
      { text: 'Done', done: true },
      { text: 'Todo', done: false },
    ]);
  });

  it('returns empty for plain prose', () => {
    assert.deepEqual(parseListItems('just a sentence'), { title: null, items: [] });
  });
});

describe('keepUntilLabel', () => {
  it('describes when a post leaves', () => {
    assert.match(keepUntilLabel('2026-10-01T00:00:00Z'), /^Leaves the board /);
  });
  it('is null for kept-forever posts', () => {
    assert.equal(keepUntilLabel(null), null);
  });
});

describe('color/rotation', () => {
  it('are deterministic and in range', () => {
    assert.equal(colorForItem('abc'), colorForItem('abc'));
    assert.equal(rotationForItem('abc'), rotationForItem('abc'));
    assert.ok(Math.abs(rotationForItem('abc')) <= 5);
  });
});
