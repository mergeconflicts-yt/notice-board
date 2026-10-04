import { useCallback, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { createStore, useStore } from 'zustand';
import { supabase } from '../lib/supabase';
import {
  addEntry as apiAddEntry,
  ApiError,
  editItem as apiEditItem,
  editList as apiEditList,
  friendlyMessage,
  getBoard,
  getBoardContent,
  getEntries,
  getItemsSince,
  getMembers,
  getRemovedItems,
  ItemEdit,
  ListEditBatch,
  NewItem,
  postItem as apiPostItem,
  keepLonger as apiKeepLonger,
  removeItem as apiRemoveItem,
  restoreItem as apiRestoreItem,
  setDone as apiSetDone,
  setEntryChecked as apiSetEntryChecked,
  setItemPosition as apiSetItemPosition,
  setPinned as apiSetPinned,
} from '../lib/api';
import { useToast } from '../store/toast';
import { useSession } from '../store/session';
import { createBoardStoreRegistry, registerBoardStoreReset } from '../lib/boardStores';
import { Board, BoardMember, ItemWithAuthor, ListEntry } from '../types';

export function randomId(): string {
  return Crypto.randomUUID();
}

function mapRealtimeItem(row: Record<string, unknown>): ItemWithAuthor {
  return {
    id: row.id as string,
    boardId: row.board_id as string,
    type: row.type as ItemWithAuthor['type'],
    color: row.color as ItemWithAuthor['color'],
    body: (row.body as string | null) ?? null,
    title: (row.title as string | null) ?? null,
    eventAt: (row.event_at as string | null) ?? null,
    place: (row.place as string | null) ?? null,
    photoPath: (row.photo_path as string | null) ?? null,
    sharedFromApp: (row.shared_from_app as string | null) ?? null,
    sharedFromAuthor: (row.shared_from_author as string | null) ?? null,
    layout:
      row.layout && typeof (row.layout as { x?: unknown }).x === 'number'
        ? {
            x: (row.layout as { x: number }).x,
            y: (row.layout as { y: number }).y,
            manual: (row.layout as { manual?: boolean }).manual === true,
          }
        : null,
    pinned: Boolean(row.pinned),
    keepUntil: (row.keep_until as string | null) ?? null,
    doneAt: (row.done_at as string | null) ?? null,
    doneBy: (row.done_by as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    updatedBy: (row.updated_by as string | null) ?? null,
    deletedAt: (row.deleted_at as string | null) ?? null,
    deletedBy: (row.deleted_by as string | null) ?? null,
    version: (row.version as number) ?? 1,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? (row.created_at as string),
    author: null,
  };
}

function mapRealtimeEntry(row: Record<string, unknown>): ListEntry {
  return {
    id: row.id as string,
    itemId: row.item_id as string,
    boardId: row.board_id as string,
    text: row.text as string,
    position: (row.position as number) ?? 0,
    checkedAt: (row.checked_at as string | null) ?? null,
    checkedBy: (row.checked_by as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? (row.created_at as string),
  };
}

/** A failed read that means the caller can no longer see the board. Losing
 *  access must wipe the cached contents rather than leave the previous
 *  account's board on screen while only showing an error. */
function isAccessLost(e: unknown): boolean {
  return (
    e instanceof ApiError &&
    (e.code === 'not_member' || e.code === 'not_authenticated' || e.code === 'not_found')
  );
}

/** A blank store, used when a read proves access is gone. */
const EMPTY_BOARD_STATE: {
  board: Board | null;
  members: BoardMember[];
  items: ItemWithAuthor[];
  entries: ListEntry[];
} = { board: null, members: [], items: [], entries: [] };

/** How far behind the cursor a delta read looks, in ms. `updated_at` is set
 *  when a transaction starts, so a write committing just after the cursor was
 *  taken could otherwise be skipped. Re-merging a row is harmless. */
const DELTA_LOOKBACK_MS = 5000;

/** Newest server timestamp across items/entries — a clock-skew-proof cursor
 *  for delta reads (never the device clock). */
function latestUpdated(items: ItemWithAuthor[], entries: ListEntry[]): string {
  let max = '';
  for (const i of items) if (i.updatedAt > max) max = i.updatedAt;
  for (const e of entries) if (e.updatedAt > max) max = e.updatedAt;
  return max;
}

/** Advance the cursor, never backwards (an empty catch-up must not reset it). */
function advanceCursor(prev: string | null, items: ItemWithAuthor[], entries: ListEntry[]): string {
  const latest = latestUpdated(items, entries);
  return latest > (prev ?? '') ? latest : (prev ?? '');
}

/** The delta `since` value: the cursor shifted back by the lookback window. */
function deltaSince(cursor: string): string {
  return new Date(new Date(cursor).getTime() - DELTA_LOOKBACK_MS).toISOString();
}

/** Resolve an item's author from the loaded members (realtime rows have no
 *  profile embed). Re-run whenever members change so an unknown `createdBy`
 *  becomes an author once that member is known. A `createdBy` that matches no
 *  member and no profile means the author left (or is gone): attribute it as
 *  a former member — same convention as `getMembers` — rather than dropping
 *  the name line entirely. */
function resolveAuthor(
  item: ItemWithAuthor,
  members: BoardMember[],
  previous?: ItemWithAuthor,
): ItemWithAuthor {
  if (item.author) return item;
  const author =
    previous?.author ?? members.find((m) => m.userId === item.createdBy)?.user ?? null;
  if (author || !item.createdBy) return { ...item, author };
  return {
    ...item,
    author: {
      id: item.createdBy,
      displayName: 'Former member',
      avatarPath: null,
      createdAt: item.createdAt,
    },
  };
}

/** Apply a delta: upsert changed items, drop deleted/expired ones. */
function mergeDeltaItems(
  prev: ItemWithAuthor[],
  delta: ItemWithAuthor[],
  members: BoardMember[],
): ItemWithAuthor[] {
  const byId = new Map(prev.map((i) => [i.id, i]));
  for (const item of delta) {
    const expired =
      item.deletedAt !== null ||
      (item.keepUntil !== null && new Date(item.keepUntil) <= new Date());
    if (expired) byId.delete(item.id);
    else byId.set(item.id, resolveAuthor(item, members, byId.get(item.id)));
  }
  return [...byId.values()];
}

/** Public shape returned by `useBoard` (a slice of the per-board store). */
export type BoardStore = {
  board: Board | null;
  members: BoardMember[];
  items: ItemWithAuthor[];
  entries: ListEntry[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  refreshMeta: () => Promise<void>;
  createItem: (input: NewItem) => Promise<void>;
  editItem: (item: ItemWithAuthor, patch: ItemEdit) => Promise<void>;
  editList: (item: ItemWithAuthor, batch: ListEditBatch) => Promise<void>;
  setPinned: (item: ItemWithAuthor, pinned: boolean) => Promise<void>;
  setDone: (item: ItemWithAuthor, done: boolean) => Promise<void>;
  keepLonger: (item: ItemWithAuthor) => Promise<void>;
  moveItem: (item: ItemWithAuthor, x: number, y: number) => Promise<void>;
  removeItem: (item: ItemWithAuthor) => Promise<void>;
  restoreItem: (item: ItemWithAuthor) => Promise<void>;
  toggleEntry: (entry: ListEntry) => void;
  addListEntry: (itemId: string, text: string, id?: string) => Promise<void>;
};

/** Internal store shape (adds the delta catch-up used by the channel). */
type BoardStoreInternal = BoardStore & {
  catchUp: () => void;
  expireLocal: () => void;
  /** Re-read the full entry set (authoritative after a parent list update). */
  refreshEntries: () => void;
};
export type BoardStoreApi = ReturnType<typeof createBoardStore>;

function createBoardStore(boardId: string) {
  // Cursor for delta catch-up. `loaded` distinguishes "never loaded" (and an
  // empty board, whose cursor is '') from a real cursor.
  let lastSeen: string | null = null;
  let loaded = false;

  return createStore<BoardStoreInternal>((set, get) => {
    const onError = (e: unknown) => {
      const toast = useToast.getState();
      if (e instanceof ApiError && e.code === 'version_conflict') {
        toast.show(friendlyMessage(e));
        void get().reload();
        return;
      }
      toast.show(friendlyMessage(e));
    };

    const patchItem = async (
      id: string,
      patch: Partial<ItemWithAuthor>,
      run: () => Promise<void>,
    ) => {
      // Roll back only this item (not the whole array), so a failure can't
      // clobber unrelated concurrent changes.
      const previous = get().items.find((i) => i.id === id);
      set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
      try {
        await run();
      } catch (e) {
        if (previous) {
          set((s) => ({ items: s.items.map((i) => (i.id === id ? previous : i)) }));
        }
        onError(e);
        throw e;
      }
    };

    return {
      board: null,
      members: [],
      items: [],
      entries: [],
      loading: true,
      error: null,

      reload: async () => {
        try {
          const [nextBoard, nextMembers, content] = await Promise.all([
            getBoard(boardId),
            getMembers(boardId),
            getBoardContent(boardId),
          ]);
          set({
            board: nextBoard,
            members: nextMembers,
            // Resolve against the fresh members too, so an item whose profile
            // embed came back empty is attributed on first paint.
            items: content.items.map((i) => resolveAuthor(i, nextMembers)),
            entries: content.entries,
            error: null,
          });
          lastSeen = advanceCursor(lastSeen, content.items, content.entries);
          loaded = true;
        } catch (e) {
          if (isAccessLost(e)) {
            // Access is gone: drop the cache so it cannot survive into the
            // next account, and force the next read to load from scratch.
            loaded = false;
            lastSeen = null;
            set({ ...EMPTY_BOARD_STATE, error: friendlyMessage(e) });
          } else {
            set({ error: friendlyMessage(e) });
          }
        } finally {
          set({ loading: false });
        }
      },

      /** Re-read the board row and members (board_members isn't on Realtime),
       *  and re-resolve any item whose author is now known. */
      refreshMeta: async () => {
        try {
          const [nextBoard, nextMembers] = await Promise.all([
            getBoard(boardId),
            getMembers(boardId),
          ]);
          set((s) => ({
            board: nextBoard,
            members: nextMembers,
            items: s.items.map((i) => resolveAuthor(i, nextMembers)),
          }));
        } catch (e) {
          // Access lost: don't keep showing a board the caller can't read.
          // Any other failure keeps the current view; focus/reload retries.
          if (isAccessLost(e)) set(EMPTY_BOARD_STATE);
        }
      },

      catchUp: () => {
        // Before the first load there is nothing to diff against; the initial
        // reload covers it.
        if (!loaded) return;
        // An empty board has no timestamp to diff from — full reload.
        if (!lastSeen) {
          void get().reload();
          return;
        }
        const since = deltaSince(lastSeen);
        void Promise.all([getItemsSince(boardId, since), getEntries(boardId)])
          .then(([deltaItems, allEntries]) => {
            const state = get();
            set({
              items: mergeDeltaItems(state.items, deltaItems, state.members),
              entries: allEntries,
            });
            lastSeen = advanceCursor(lastSeen, deltaItems, allEntries);
          })
          .catch(() => {});
      },

      // A post whose keep_until lapses while the board is open must disappear
      // without waiting for a reload.
      expireLocal: () =>
        set((s) => {
          const now = Date.now();
          const next = s.items.filter(
            (i) => !(i.keepUntil && new Date(i.keepUntil).getTime() <= now),
          );
          return next.length === s.items.length ? s : { items: next };
        }),

      // Authoritative entries after a parent list update. Realtime DELETE
      // events on list_entries are not reliable (RLS evaluates against the
      // deleted row, and filtered DELETEs need REPLICA IDENTITY FULL), so a
      // parent update is the signal to re-read the whole set — every client
      // converges on the same entries, removed or not.
      refreshEntries: () => {
        void getEntries(boardId)
          .then((allEntries) => {
            set({ entries: allEntries });
          })
          .catch(() => {});
      },

      createItem: async (input) => {
        const me = useSession.getState().user;
        const temp: ItemWithAuthor = {
          id: input.id,
          boardId: input.boardId,
          type: input.type,
          color: input.color,
          body: input.body ?? null,
          title: input.title ?? null,
          eventAt: input.eventAt ?? null,
          place: input.place ?? null,
          photoPath: input.photoPath ?? null,
          sharedFromApp: input.sharedFromApp ?? null,
          sharedFromAuthor: input.sharedFromAuthor ?? null,
          layout: null,
          pinned: input.pinned ?? false,
          keepUntil: null,
          doneAt: null,
          doneBy: null,
          // Attribute it to me immediately so my own new post never flashes as
          // "Former member" while the round-trip settles.
          createdBy: me?.id ?? null,
          updatedBy: null,
          deletedAt: null,
          deletedBy: null,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          author: me ?? null,
        };
        set((s) => ({ items: [...s.items, temp] }));
        try {
          const saved = await apiPostItem(input);
          const merged = resolveAuthor(saved, get().members, temp);
          set((s) => ({ items: s.items.map((i) => (i.id === input.id ? merged : i)) }));
          // Entries for a fresh list arrive via realtime; nothing else to do.
        } catch (e) {
          set((s) => ({ items: s.items.filter((i) => i.id !== input.id) }));
          onError(e);
          throw e;
        }
      },

      editItem: (item, patch) =>
        patchItem(
          item.id,
          {
            body: patch.body !== undefined ? patch.body : item.body,
            title: patch.title !== undefined ? patch.title : item.title,
            eventAt: patch.eventAt !== undefined ? patch.eventAt : item.eventAt,
            place: patch.place !== undefined ? patch.place : item.place,
            color: patch.color ?? item.color,
          },
          () => apiEditItem(item, patch),
        ),

      editList: async (item, batch) => {
        // One atomic RPC for the title/colour AND all entry changes; on success
        // re-read so the local entry set exactly matches the server.
        try {
          await apiEditList(item, batch);
          await get().reload();
        } catch (e) {
          onError(e);
          throw e;
        }
      },

      setPinned: (item, pinned) =>
        patchItem(item.id, { pinned, keepUntil: pinned ? null : item.keepUntil }, () =>
          apiSetPinned(item.id, pinned),
        ),

      setDone: (item, done) =>
        patchItem(item.id, { doneAt: done ? new Date().toISOString() : null }, () =>
          apiSetDone(item.id, done),
        ),

      keepLonger: async (item) => {
        // Optimistic +7d (capped at now + 30d, never shortening), mirroring
        // the server's keep_cycle math, so the new date shows instantly.
        // When a full +7d step no longer fits under the cap the server wraps
        // back to the type default (unknowable here for dates — it needs the
        // board timezone), so keep the current date and let the reload after
        // snap to the reset value. A reload after reconciles the exact
        // server timestamp.
        const nowMs = Date.now();
        const curMs = item.keepUntil ? new Date(item.keepUntil).getTime() : NaN;
        let optimisticMs: number;
        if (Number.isNaN(curMs)) {
          optimisticMs = Math.min(nowMs + 7 * 86400000, nowMs + 30 * 86400000);
        } else {
          const base = Math.max(curMs, nowMs);
          // The server wraps instead of extending when a full step no longer
          // fits: hold the current date; the reload below snaps to the reset.
          optimisticMs = base + 7 * 86400000 > nowMs + 30 * 86400000 ? curMs : base + 7 * 86400000;
        }
        await patchItem(
          item.id,
          { keepUntil: new Date(optimisticMs).toISOString() },
          () => apiKeepLonger(item.id),
        );
        await get().reload();
      },

      moveItem: (item, x, y) =>
        patchItem(item.id, { layout: { x, y, manual: true } }, () =>
          apiSetItemPosition(item.id, x, y),
        ),

      removeItem: (item) =>
        patchItem(item.id, {}, () => apiRemoveItem(item.id)).then(() => {
          set((s) => ({ items: s.items.filter((i) => i.id !== item.id) }));
        }),

      restoreItem: async (item) => {
        // Put it straight back on the board, then persist (undo path).
        set((s) =>
          s.items.some((i) => i.id === item.id) ? s : { items: [...s.items, item] },
        );
        try {
          await apiRestoreItem(item.id);
        } catch (e) {
          set((s) => ({ items: s.items.filter((i) => i.id !== item.id) }));
          onError(e);
          throw e;
        }
      },

      toggleEntry: (entry) => {
        const next = entry.checkedAt === null;
        const previous = entry;
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === entry.id ? { ...e, checkedAt: next ? new Date().toISOString() : null } : e,
          ),
        }));
        apiSetEntryChecked(entry.id, next).catch((e) => {
          set((s) => ({ entries: s.entries.map((cur) => (cur.id === entry.id ? previous : cur)) }));
          onError(e);
        });
      },

      addListEntry: async (itemId, text, id = randomId()) => {
        const position = get().entries.filter((e) => e.itemId === itemId).length;
        const temp: ListEntry = {
          id,
          itemId,
          boardId,
          text,
          position,
          checkedAt: null,
          checkedBy: null,
          createdBy: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ entries: [...s.entries, temp] }));
        try {
          // The caller may supply the client id so a retry after a partial
          // failure maps to the same row (add_entry is idempotent on p_id).
          const saved = await apiAddEntry(id, itemId, text);
          set((s) => ({ entries: s.entries.map((e) => (e.id === id ? saved : e)) }));
        } catch (e) {
          set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
          onError(e);
          throw e;
        }
      },
    };
  });
}

/** Start the realtime channel + foreground refresh for a board. Returns a
 *  disposer; called when the first screen for the board mounts and torn down
 *  when the last one unmounts. */
function startBoard(store: BoardStoreApi, boardId: string): () => void {
  void store.getState().reload();

  const topic = `board:${boardId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
  const channel = supabase
    .channel(topic)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'items', filter: `board_id=eq.${boardId}` },
      (payload) => {
        // DELETE events are ignored: client-visible rows are never
        // hard-deleted (removals are soft-deletes via UPDATE; the purge job
        // only hard-deletes long-invisible rows). Filtered DELETEs also can't
        // carry RLS reliably (needs REPLICA IDENTITY FULL).
        if (payload.eventType === 'DELETE') return;
        const mapped = mapRealtimeItem(payload.new as Record<string, unknown>);
        const expired =
          mapped.deletedAt !== null ||
          (mapped.keepUntil !== null && new Date(mapped.keepUntil) <= new Date());
        // A parent list update also means its entries changed (adds/edits/
        // removes land in the same transaction as the item's version bump):
        // re-read the authoritative set. A removed item's entries vanish with
        // it, so refetch there too.
        if (mapped.type === 'list' || expired) {
          (store.getState() as BoardStoreInternal).refreshEntries();
        }
        store.setState((s) => {
          const previous = s.items.find((i) => i.id === mapped.id);
          const without = s.items.filter((i) => i.id !== mapped.id);
          if (expired) return { items: without };
          return { items: [...without, resolveAuthor(mapped, s.members, previous)] };
        });
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'boards', filter: `id=eq.${boardId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') return;
        const row = payload.new as { deleted_at?: string | null };
        if (row.deleted_at) {
          store.setState({ board: null });
          return;
        }
        // The row is raw; refetch to map it (and pick up name/colour).
        void getBoard(boardId)
          .then((next) => {
            if (next) store.setState({ board: next });
          })
          .catch(() => {});
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'list_entries', filter: `board_id=eq.${boardId}` },
      (payload) => {
        // DELETEs are handled via the parent list update (refreshEntries):
        // realtime DELETE payloads carry only the old key and can't apply
        // RLS to the deleted row.
        if (payload.eventType === 'DELETE') return;
        const mapped = mapRealtimeEntry(payload.new as Record<string, unknown>);
        store.setState((s) => ({
          entries: [...s.entries.filter((e) => e.id !== mapped.id), mapped],
        }));
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') store.getState().catchUp();
    });

  const appSub = AppState.addEventListener('change', (next) => {
    if (next === 'active') void store.getState().reload();
  });

  // Drop locally-expired posts while the board stays open.
  const expireTimer = setInterval(() => store.getState().expireLocal(), 30000);

  return () => {
    void supabase.removeChannel(channel);
    appSub.remove();
    clearInterval(expireTimer);
  };
}

const registry = createBoardStoreRegistry<BoardStoreApi>();
// Every identity change (sign-out, account deletion, "start fresh", account
// switch) tears these stores down, so a previous account's board cache can
// never be shown to the next one. Errors during reset must not block sign-out.
registerBoardStoreReset(() => registry.reset());

/** Shared, per-board hook: every screen for a board uses the same store (and
 *  therefore the same channel/load), so changes propagate everywhere and undo
 *  never runs through an unmounted hook. */
export function useBoard(boardId: string): BoardStore {
  const store = useMemo(
    () => registry.getOrCreate(boardId, () => createBoardStore(boardId)).store,
    [boardId],
  );
  const state = useStore(store);

  useEffect(
    () => registry.acquire(boardId, () => createBoardStore(boardId), startBoard),
    [boardId],
  );

  // Focus refresh keeps the member list current (board_members is not on
  // Realtime) and re-resolves authors for members who arrived late.
  useFocusEffect(
    useCallback(() => {
      void store.getState().refreshMeta();
    }, [store]),
  );

  return state;
}

export async function fetchRemovedItems(boardId: string): Promise<ItemWithAuthor[]> {
  return getRemovedItems(boardId);
}
