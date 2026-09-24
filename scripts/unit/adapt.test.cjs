// Unit tests for the v2 -> board-note adapter (pure logic, no device APIs).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const BUILD = process.env.TEST_BUILD;
if (!BUILD) throw new Error('TEST_BUILD env var is required (see scripts/run-unit-tests.cjs)');
const { adaptItemToNote } = require(`${BUILD}/utils/adapt.js`);

const base = {
  id: 'i1', boardId: 'b', createdBy: 'u1', createdAt: '2026-01-01T00:00:00Z',
  updatedBy: null, updatedAt: null, completedBy: null, completedAt: null,
  deletedBy: null, deletedAt: null, version: 1, author: null,
};

describe('adaptItemToNote', () => {
  it('maps a plain note', () => {
    const n = adaptItemToNote({ ...base, type: 'note', body: 'hello', eventAt: null,
      expiresAt: null, paper: { color: 'green', rotation: 2 }, layout: null }, [], null);
    assert.equal(n.text, 'hello');
    assert.equal(n.color, 'green');
    assert.equal(n.rotation, 2);
    assert.equal(n.positionX, 0.5);
    assert.equal(n.kind, 'note');
    assert.equal(n.data, null);
    assert.equal(n.authorId, 'u1');
  });

  it('rebuilds list text ordered by position', () => {
    const n = adaptItemToNote({ ...base, id: 'i2', type: 'list', body: 'Groceries',
      paper: { color: 'yellow', rotation: 0 }, layout: null },
      [{ id: 'e2', itemId: 'i2', text: 'Eggs', position: 1, isChecked: false },
       { id: 'e1', itemId: 'i2', text: 'Milk', position: 0, isChecked: true }], null);
    assert.equal(n.text, 'Groceries\n☑ Milk\n☐ Eggs');
    assert.equal(n.kind, 'list');
    assert.deepEqual(n.data.items, [
      { text: 'Milk', done: true },
      { text: 'Eggs', done: false },
    ]);
  });

  it('maps photo image urls', () => {
    const n = adaptItemToNote({ ...base, id: 'i3', type: 'photo', body: 'cap',
      paper: { color: 'pink', rotation: 0 }, layout: null }, [], 'https://signed/x');
    assert.equal(n.kind, 'photo');
    assert.equal(n.imageUrl, 'https://signed/x');
  });

  it('maps date to appointment with eventAt', () => {
    const n = adaptItemToNote({ ...base, id: 'i4', type: 'date', body: 'Dentist',
      eventAt: '2026-09-25T15:30:00Z', paper: { color: 'blue', rotation: 0 }, layout: null }, [], null);
    assert.equal(n.kind, 'appointment');
    assert.equal(n.data.eventAt, '2026-09-25T15:30:00Z');
  });

  it('keeps manual drag positions', () => {
    const n = adaptItemToNote({ ...base, id: 'i5', type: 'note', body: 'x',
      paper: { color: 'yellow', rotation: 0 }, layout: { x: 0.62, y: 210.5, manual: true } }, [], null);
    assert.equal(n.positionX, 0.62);
    assert.equal(n.positionY, 210.5);
    assert.equal(n.data.manual, true);
  });

  it('passes completion and author through', () => {
    const n = adaptItemToNote({ ...base, id: 'i6', type: 'note', body: 'x',
      completedAt: '2026-01-02T00:00:00Z', paper: { color: 'yellow', rotation: 0 }, layout: null,
      author: { id: 'u1', displayName: 'Zed', avatar: null, createdAt: '' } }, [], null);
    assert.equal(n.completedAt, '2026-01-02T00:00:00Z');
    assert.equal(n.author.displayName, 'Zed');
    assert.equal(n.updatedAt, '2026-01-01T00:00:00Z');
  });

  it('turns null bodies into empty text', () => {
    const n = adaptItemToNote({ ...base, id: 'i7', type: 'photo', body: null,
      paper: { color: 'yellow', rotation: 0 }, layout: null }, [], null);
    assert.equal(n.text, '');
    assert.equal(n.imageUrl, null);
  });
});
