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
  projectedLeaveMs,
  leaveBoardCopy,
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

describe('projectedLeaveMs', () => {
  const DAY = 86400000;
  // Fixed local noon avoids DST-boundary flakiness in day arithmetic.
  const NOW = new Date(2026, 9, 3, 12).getTime();
  it('notes leave 7 days out, photos 14, each +7d per Keep tap', () => {
    assert.equal(
      projectedLeaveMs({ type: 'note', eventAtMs: NOW, pinned: false, keepExtra: 0, nowMs: NOW }),
      NOW + 7 * DAY,
    );
    assert.equal(
      projectedLeaveMs({ type: 'photo', eventAtMs: NOW, pinned: false, keepExtra: 2, nowMs: NOW }),
      NOW + 28 * DAY,
    );
  });
  it('dates leave the day after the event, plus Keep taps', () => {
    const event = new Date(2026, 9, 10, 18, 30).getTime(); // Oct 10 evening
    assert.equal(
      projectedLeaveMs({ type: 'date', eventAtMs: event, pinned: false, keepExtra: 1, nowMs: NOW }),
      new Date(2026, 9, 11).getTime() + 7 * DAY,
    );
  });
  it('caps at +30d and never expires pinned posts or lists', () => {
    assert.equal(
      projectedLeaveMs({ type: 'photo', eventAtMs: NOW, pinned: false, keepExtra: 3, nowMs: NOW }),
      NOW + 30 * DAY,
    );
    assert.equal(
      projectedLeaveMs({ type: 'note', eventAtMs: NOW, pinned: true, keepExtra: 0, nowMs: NOW }),
      null,
    );
    assert.equal(
      projectedLeaveMs({ type: 'list', eventAtMs: NOW, pinned: false, keepExtra: 0, nowMs: NOW }),
      null,
    );
  });
});

describe('leaveBoardCopy', () => {
  const DAY = 86400000;
  const NOW = new Date(2026, 9, 3, 12).getTime();
  it('says today / tomorrow / on-date', () => {
    assert.equal(leaveBoardCopy(NOW + 2 * 3600000, NOW), 'Leaves today');
    assert.equal(leaveBoardCopy(NOW + DAY, NOW), 'Leaves tomorrow');
    assert.equal(leaveBoardCopy(NOW + 9 * DAY, NOW), 'Leaves on 12 Oct');
  });
});
