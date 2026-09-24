// Unit tests for the deterministic board layout (pure logic).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const BUILD = process.env.TEST_BUILD;
if (!BUILD) throw new Error('TEST_BUILD env var is required (see scripts/run-unit-tests.cjs)');
const { computeBoardLayout, estimateItemHeight, boardCanvasHeight } = require(`${BUILD}/utils/layout.js`);

let seq = 0;
function mk(type, extra = {}) {
  seq += 1;
  return {
    id: 'item-' + seq,
    boardId: 'b',
    type,
    color: 'butter',
    body: null,
    title: null,
    eventAt: null,
    place: null,
    photoPath: null,
    layout: null,
    pinned: false,
    keepUntil: null,
    doneAt: null,
    doneBy: null,
    createdBy: 'a',
    updatedBy: null,
    deletedAt: null,
    deletedBy: null,
    version: 1,
    createdAt: new Date(2020, 0, 1, 0, 0, seq).toISOString(),
    updatedAt: new Date(2020, 0, 1, 0, 0, seq).toISOString(),
    author: null,
    ...extra,
  };
}

describe('computeBoardLayout', () => {
  it('places every item deterministically', () => {
    const items = [mk('note', { body: 'a' }), mk('list', { title: 'S' }), mk('date', { title: 'D', eventAt: '2026-01-01T00:00:00Z' })];
    const a = computeBoardLayout(items);
    const b = computeBoardLayout(items);
    assert.equal(a.size, items.length);
    for (const item of items) {
      assert.deepEqual(a.get(item.id), b.get(item.id));
    }
  });

  it('uses two columns and keeps same-column items from overlapping', () => {
    const items = Array.from({ length: 6 }, () => mk('note', { body: 'hello there' }));
    const out = computeBoardLayout(items);
    const xs = [...new Set(items.map((i) => out.get(i.id).x))];
    assert.equal(xs.length, 2, 'exactly two column x positions');
    // Group by column and verify vertical stacks never overlap.
    for (const x of xs) {
      const col = items
        .map((i) => out.get(i.id))
        .filter((p) => p.x === x)
        .sort((p, q) => p.y - q.y);
      for (let i = 1; i < col.length; i++) {
        assert.ok(col[i].y >= col[i - 1].y + col[i - 1].h, 'columns stack without overlap');
      }
    }
  });

  it('honours a saved manual position', () => {
    const placed = mk('note', { body: 'x', layout: { x: 0.6, y: 400, manual: true } });
    const out = computeBoardLayout([placed]);
    assert.equal(out.get(placed.id).x, 0.6);
    assert.equal(out.get(placed.id).y, 400);
  });

  it('gives each item a stable tilt within range', () => {
    const items = [mk('note', { body: 'x' }), mk('note', { body: 'y' })];
    const out = computeBoardLayout(items);
    for (const item of items) {
      const r = out.get(item.id).rotation;
      assert.ok(Math.abs(r) <= 5, `tilt in range: ${r}`);
    }
  });
});

describe('estimateItemHeight', () => {
  it('grows with more text', () => {
    const short = estimateItemHeight(mk('note', { body: 'hi' }), 0.45);
    const long = estimateItemHeight(mk('note', { body: 'x'.repeat(400) }), 0.45);
    assert.ok(long > short);
  });

  it('floors small items', () => {
    assert.ok(estimateItemHeight(mk('note', { body: 'hi' }), 0.45) > 0);
  });
});

describe('boardCanvasHeight', () => {
  it('covers the lowest item', () => {
    const items = [mk('note', { body: 'a' }), mk('note', { body: 'b' })];
    const layout = computeBoardLayout(items);
    const scale = 1.2;
    let bottom = 0;
    layout.forEach((p) => {
      bottom = Math.max(bottom, p.y + p.h);
    });
    assert.ok(boardCanvasHeight(layout, scale) >= bottom * scale);
  });
});
