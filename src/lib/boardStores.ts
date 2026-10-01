/** Per-board store registry + identity-change reset bus.
 *
 * Board stores are module-level singletons (one per board id) so every screen
 * for a board shares a channel and a cache. That cache must not outlive the
 * signed-in identity: a board the previous account could read must never be
 * shown to the next account after sign-out, account deletion, "start fresh",
 * or an account switch. `resetAllBoardStores` tears every store down; session
 * transitions invoke it. Kept dependency-free so it is unit-testable without
 * a device or backend.
 */

export type BoardStoreEntry<TStore> = {
  store: TStore;
  refs: number;
  stop: (() => void) | null;
};

export type BoardStoreRegistry<TStore> = {
  getOrCreate(boardId: string, factory: () => TStore): BoardStoreEntry<TStore>;
  acquire(
    boardId: string,
    factory: () => TStore,
    start: (store: TStore, boardId: string) => () => void,
  ): () => void;
  reset(): void;
  size(): number;
};

export function createBoardStoreRegistry<TStore>(): BoardStoreRegistry<TStore> {
  const registry = new Map<string, BoardStoreEntry<TStore>>();

  function getOrCreate(boardId: string, factory: () => TStore): BoardStoreEntry<TStore> {
    let entry = registry.get(boardId);
    if (!entry) {
      entry = { store: factory(), refs: 0, stop: null };
      registry.set(boardId, entry);
    }
    return entry;
  }

  return {
    getOrCreate,

    acquire(boardId, factory, start) {
      const entry = getOrCreate(boardId, factory);
      entry.refs += 1;
      if (entry.refs === 1 && !entry.stop) {
        entry.stop = start(entry.store, boardId);
      }
      return () => {
        entry.refs -= 1;
        if (entry.refs === 0 && entry.stop) {
          entry.stop();
          entry.stop = null;
        }
      };
    },

    reset() {
      for (const entry of registry.values()) {
        if (entry.stop) entry.stop();
        entry.stop = null;
      }
      registry.clear();
    },

    size() {
      return registry.size;
    },
  };
}

// --- Identity-change reset bus ---------------------------------------------

const resetters = new Set<() => void>();

/** Register a store collection that must be torn down on any identity change.
 *  Returns nothing; the app registers once at module load. */
export function registerBoardStoreReset(reset: () => void): void {
  resetters.add(reset);
}

/** Tear down every registered board store. Call on sign-out, account deletion,
 *  "start fresh", and whenever the signed-in user id changes. A throwing
 *  teardown never blocks the others or the sign-out itself. */
export function resetAllBoardStores(): void {
  for (const reset of [...resetters]) {
    try {
      reset();
    } catch {
      // Reset must always complete; never let one store block the rest.
    }
  }
}
