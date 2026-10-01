// Unit tests for the board-store registry + identity-change reset.
// Regression: stores stayed in a module-level registry after sign-out, so a
// previous account's board cache could survive into the next account.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const BUILD = process.env.TEST_BUILD;
if (!BUILD) throw new Error('TEST_BUILD env var is required (see scripts/run-unit-tests.cjs)');
const {
  createBoardStoreRegistry,
  registerBoardStoreReset,
  resetAllBoardStores,
} = require(`${BUILD}/lib/boardStores.js`);

describe('board store registry', () => {
  it('shares one store per board id and tears down on the last release', () => {
    const registry = createBoardStoreRegistry();
    let starts = 0;
    let stops = 0;
    const factory = () => ({ value: 'x' });
    const start = () => {
      starts += 1;
      return () => {
        stops += 1;
      };
    };

    const release1 = registry.acquire('a', factory, start);
    assert.equal(starts, 1, 'first acquire starts the channel');
    const release2 = registry.acquire('a', factory, start);
    assert.equal(starts, 1, 'second acquire reuses the running channel');
    release1();
    assert.equal(stops, 0, 'channel stays while a screen still holds it');
    release2();
    assert.equal(stops, 1, 'channel stops on the last release');

    const release3 = registry.acquire('a', factory, start);
    assert.equal(starts, 2, 're-acquiring after teardown restarts');
    release3();
  });

  it('account A -> sign-out -> account B never reuses A cached store', () => {
    const registry = createBoardStoreRegistry();
    registerBoardStoreReset(() => registry.reset());
    let stopped = 0;
    const release = registry.acquire('board-1', () => ({ account: 'A' }), () => () => {
      stopped += 1;
    });
    const aStore = registry.getOrCreate('board-1', () => ({ account: 'A' })).store;
    assert.equal(aStore.account, 'A');

    // Sign-out / account switch.
    resetAllBoardStores();
    assert.equal(stopped, 1, 'account A channel stopped');
    assert.equal(registry.size(), 0, 'account A store removed from the registry');
    release(); // an unmount racing the reset must be a no-op, not an error

    // Account B opens the same board id.
    const bStore = registry.getOrCreate('board-1', () => ({ account: 'B' })).store;
    assert.equal(bStore.account, 'B', 'account B gets a fresh store');
    assert.notEqual(bStore, aStore, 'account B never reuses account A data');
  });

  it('one failing teardown does not block the rest', () => {
    registerBoardStoreReset(() => {
      throw new Error('boom');
    });
    let ran = false;
    registerBoardStoreReset(() => {
      ran = true;
    });
    resetAllBoardStores();
    assert.equal(ran, true, 'remaining resetters still ran');
  });
});
