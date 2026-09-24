// Unit tests for the deterministic board layout (pure logic).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const BUILD = process.env.TEST_BUILD;
if (!BUILD) throw new Error('TEST_BUILD env var is required (see scripts/run-unit-tests.cjs)');
const layout = require(`${BUILD}/utils/layout.js`);
const { computeBoardLayout, settleManual, manualPlacement, TWO_COLUMN_MAX } = layout;

function mk(i, text, kind = 'note', extra = {}) {
  return {
    id: 'n' + i, boardId: 'b', authorId: 'a', text, imageUrl: null,
    color: 'yellow', rotation: 0, positionX: 0.5, positionY: 0.5, kind,
    data: null, createdAt: new Date(2020, 0, 1, 0, 0, i).toISOString(),
    updatedAt: '', expiresAt: null, completedAt: null, author: null, ...extra,
  };
}

function overlapFrac(a, b) {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const m = Math.min(a.w * a.h, b.w * b.h);
  return m > 0 ? (ix * iy) / m : 0;
}

describe('computeBoardLayout', () => {
  it('uses two sections at or under the threshold', () => {
    const notes = Array.from({ length: TWO_COLUMN_MAX },
      (_, i) => mk(i + 1, 'Note ' + (i + 1)));
    const out = computeBoardLayout(notes);
    assert.equal(out.size, TWO_COLUMN_MAX);
    // Two loose sides: some notes left of centre, some right of it.
    const xs = notes.map((n) => out.get(n.id).x);
    assert.ok(Math.min(...xs) < 0.2, 'has left-side notes');
    assert.ok(Math.max(...xs) > 0.45, 'has right-side notes');
  });

  it('falls back to the fold above the threshold', () => {
    const notes = Array.from({ length: TWO_COLUMN_MAX + 1 },
      (_, i) => mk(i + 1, 'Note ' + (i + 1)));
    const out = computeBoardLayout(notes);
    assert.equal(out.size, TWO_COLUMN_MAX + 1);
    // Fold uses three landing zones, so some note sits in the middle band.
    const xs = notes.map((n) => out.get(n.id).x);
    assert.ok(xs.some((x) => x > 0.3 && x < 0.6), 'has a middle-zone note');
  });

  it('keeps hand-placed notes where they were dropped', () => {
    const notes = [mk(1, 'a'), mk(2, 'b')];
    const manual = { ...notes[1], positionX: 0.7, positionY: 400, data: { manual: true } };
    const out = computeBoardLayout([notes[0], manual]);
    const p = out.get(manual.id);
    assert.equal(p.x, 0.7);
    assert.equal(p.y, 400);
  });

  it('two-column notes respect the minimums', () => {
    const out = computeBoardLayout([mk(1, 'Hi')]);
    const p = out.get('n1');
    assert.ok(p.w >= 0.4, `width floor w=${p.w}`);
    assert.ok(p.h >= 100, `height floor h=${p.h}`);
  });
});

describe('settleManual', () => {
  it('clamps a note fully on screen using its width', () => {
    const p = settleManual(0.95, 50, 0.4, 120, []);
    assert.ok(p.x + 0.4 <= 1.0001, `right edge ${p.x + 0.4}`);
    assert.ok(p.x >= 0, `left edge ${p.x}`);
    const q = settleManual(-0.2, 50, 0.4, 120, []);
    assert.ok(q.x >= 0, `left edge ${q.x}`);
  });

  it('pushes a burying drop below its neighbour', () => {
    // A small note dropped squarely on top of a big one.
    const other = { x: 0.1, y: 100, w: 0.4, h: 300 };
    const p = settleManual(0.12, 120, 0.35, 120, [other]);
    assert.ok(overlapFrac({ ...p, w: 0.35, h: 120 }, other) <= 0.41,
      `overlap ${overlapFrac({ ...p, w: 0.35, h: 120 }, other)}`);
    assert.ok(p.y >= 120, 'only moved down, never up');
  });
});

describe('manualPlacement', () => {
  it('returns null without the manual flag', () => {
    assert.equal(manualPlacement(mk(1, 'a')), null);
  });
});
