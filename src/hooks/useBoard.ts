import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { supabase } from '../lib/supabase';
import {
  addEntry as apiAddEntry,
  ApiError,
  editItem as apiEditItem,
  friendlyMessage,
  getBoard,
  getBoardContent,
  getEntries,
  getItemsSince,
  getMembers,
  getRemovedItems,
  ItemEdit,
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
function deltaSince(cursor: string | null): string | undefined {
  if (!cursor) return undefined;
  return new Date(new Date(cursor).getTime() - DELTA_LOOKBACK_MS).toISOString();
}

/** Live board state: board, people, posts and checklist rows. */
export function useBoard(boardId: string) {
  const [board, setBoard] = useState<Board | null>(null);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [items, setItems] = useState<ItemWithAuthor[]>([]);
  const [entries, setEntries] = useState<ListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastSeenRef = useRef<string | null>(null);
  const membersRef = useRef<BoardMember[]>([]);
  const itemsRef = useRef<ItemWithAuthor[]>([]);
  useEffect(() => {
    membersRef.current = members;
  }, [members]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  /** Resolve an item's author from the loaded members (realtime rows have no
   *  profile embed, so without this the author shows as unknown). */
  const withAuthor = useCallback((item: ItemWithAuthor, previous?: ItemWithAuthor) => {
    if (item.author) return item;
    const author =
      previous?.author ??
      membersRef.current.find((m) => m.userId === item.createdBy)?.user ??
      null;
    return { ...item, author };
  }, []);

  const load = useCallback(async () => {
    try {
      const [nextBoard, nextMembers, content] = await Promise.all([
        getBoard(boardId),
        getMembers(boardId),
        getBoardContent(boardId),
      ]);
      setBoard(nextBoard);
      setMembers(nextMembers);
      setItems(content.items);
      setEntries(content.entries);
      lastSeenRef.current = advanceCursor(lastSeenRef.current, content.items, content.entries);
      setError(null);
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  // Initial load. Written inline (not via `load()`) so React's lint rule sees
  // the setState calls only inside the async continuation, not synchronously
  // in the effect body.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [nextBoard, nextMembers, content] = await Promise.all([
          getBoard(boardId),
          getMembers(boardId),
          getBoardContent(boardId),
        ]);
        if (!alive) return;
        setBoard(nextBoard);
        setMembers(nextMembers);
        setItems(content.items);
        setEntries(content.entries);
        lastSeenRef.current = advanceCursor(lastSeenRef.current, content.items, content.entries);
        setError(null);
      } catch (e) {
        if (alive) setError(friendlyMessage(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [boardId]);

  const reload = useCallback(() => {
    setLoading(true);
    return load();
  }, [load]);

  // Safety net: refresh the board row whenever a board screen regains focus
  // (covers a missed realtime event or a change made on another device).
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void getBoard(boardId).then((next) => {
        if (alive) setBoard(next);
      });
      return () => {
        alive = false;
      };
    }, [boardId]),
  );

  // Realtime: one channel per open board. Rows are applied in place; a
  // reconnect (SUBSCRIBED after a drop) triggers a delta read instead of a
  // full refetch.
  useEffect(() => {
    // A unique topic per subscription: `channel(topic)` returns an existing
    // (already-subscribed) channel, and adding callbacks after subscribe()
    // throws. Remounts / fast-refresh must not collide.
    const topic = `board:${boardId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `board_id=eq.${boardId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id?: string }).id;
            if (id) setItems((prev) => prev.filter((i) => i.id !== id));
            return;
          }
          const row = payload.new as Record<string, unknown>;
          const mapped = mapRealtimeItem(row);
          const expired =
            mapped.deletedAt !== null ||
            (mapped.keepUntil !== null && new Date(mapped.keepUntil) <= new Date());
          setItems((prev) => {
            const without = prev.filter((i) => i.id !== mapped.id);
            if (expired) return without;
            return [...without, withAuthor(mapped, prev.find((i) => i.id === mapped.id))];
          });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'board_members', filter: `board_id=eq.${boardId}` },
        () => {
          void getMembers(boardId).then(setMembers).catch(() => {});
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'boards', filter: `id=eq.${boardId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setBoard(null);
            return;
          }
          const row = payload.new as { deleted_at?: string | null };
          if (row.deleted_at) {
            setBoard(null);
            return;
          }
          // The row is raw; refetch to map it (and pick up name/colour).
          void getBoard(boardId).then((next) => {
            if (next) setBoard(next);
          });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'list_entries', filter: `board_id=eq.${boardId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id?: string }).id;
            if (id) setEntries((prev) => prev.filter((e) => e.id !== id));
            return;
          }
          const mapped = mapRealtimeEntry(payload.new as Record<string, unknown>);
          setEntries((prev) => [...prev.filter((e) => e.id !== mapped.id), mapped]);
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && lastSeenRef.current) {
          // Catch up on items changed since the cursor — including deletions,
          // which the live filter would hide — and take the full (small) entry
          // list so hard-deleted rows disappear.
          const since = deltaSince(lastSeenRef.current)!;
          void Promise.all([getItemsSince(boardId, since), getEntries(boardId)])
            .then(([deltaItems, allEntries]) => {
              setItems((prev) => mergeDeltaItems(prev, deltaItems, withAuthor));
              setEntries(allEntries);
              lastSeenRef.current = advanceCursor(
                lastSeenRef.current,
                deltaItems,
                allEntries,
              );
            })
            .catch(() => {});
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [boardId, withAuthor]);

  // Returning to the foreground refetches everything, catching up on posts,
  // members and deletions missed while backgrounded.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void load();
    });
    return () => sub.remove();
  }, [load]);

  const toast = useToast.getState();

  const onError = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.code === 'version_conflict') {
        toast.show(friendlyMessage(e));
        void load();
        return;
      }
      toast.show(friendlyMessage(e));
    },
    [load, toast],
  );

  const createItem = useCallback(
    async (input: NewItem) => {
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
        layout: null,
        pinned: input.pinned ?? false,
        keepUntil: null,
        doneAt: null,
        doneBy: null,
        createdBy: null,
        updatedBy: null,
        deletedAt: null,
        deletedBy: null,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: null,
      };
      setItems((prev) => [...prev, temp]);
      try {
        const saved = await apiPostItem(input);
        setItems((prev) => prev.map((i) => (i.id === input.id ? { ...saved, author: saved.author ?? temp.author } : i)));
        // Entries for a fresh list arrive via realtime; nothing else to do.
      } catch (e) {
        setItems((prev) => prev.filter((i) => i.id !== input.id));
        onError(e);
        throw e;
      }
    },
    [onError],
  );

  const patchItem = useCallback(
    async (id: string, patch: Partial<ItemWithAuthor>, run: () => Promise<void>) => {
      // Roll back only this item (not the whole array), so a failure can't
      // clobber unrelated concurrent changes.
      const previous = itemsRef.current.find((i) => i.id === id);
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
      try {
        await run();
      } catch (e) {
        if (previous) setItems((prev) => prev.map((i) => (i.id === id ? previous : i)));
        onError(e);
        throw e;
      }
    },
    [onError],
  );

  const editItem = useCallback(
    async (item: ItemWithAuthor, patch: ItemEdit) =>
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
    [patchItem],
  );

  const setPinned = useCallback(
    (item: ItemWithAuthor, pinned: boolean) =>
      patchItem(item.id, { pinned, keepUntil: pinned ? null : item.keepUntil }, () =>
        apiSetPinned(item.id, pinned),
      ),
    [patchItem],
  );

  const setDone = useCallback(
    (item: ItemWithAuthor, done: boolean) =>
      patchItem(item.id, { doneAt: done ? new Date().toISOString() : null }, () =>
        apiSetDone(item.id, done),
      ),
    [patchItem],
  );

  const keepLonger = useCallback(
    (item: ItemWithAuthor) => patchItem(item.id, {}, () => apiKeepLonger(item.id)),
    [patchItem],
  );

  const moveItem = useCallback(
    (item: ItemWithAuthor, x: number, y: number) =>
      patchItem(item.id, { layout: { x, y, manual: true } }, () =>
        apiSetItemPosition(item.id, x, y),
      ),
    [patchItem],
  );

  const removeItem = useCallback(
    (item: ItemWithAuthor) =>
      patchItem(item.id, {}, () => apiRemoveItem(item.id)).then(() => {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }),
    [patchItem],
  );

  const restoreItem = useCallback(
    async (item: ItemWithAuthor) => {
      // Put it straight back on the board, then persist (undo path).
      setItems((prev) => (prev.some((i) => i.id === item.id) ? prev : [...prev, item]));
      try {
        await apiRestoreItem(item.id);
      } catch (e) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        onError(e);
        throw e;
      }
    },
    [onError],
  );

  const toggleEntry = useCallback(
    (entry: ListEntry) => {
      const next = entry.checkedAt === null;
      const previous = entry;
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? { ...e, checkedAt: next ? new Date().toISOString() : null }
            : e,
        ),
      );
      apiSetEntryChecked(entry.id, next).catch((e) => {
        // Restore just this row.
        setEntries((prev) => prev.map((cur) => (cur.id === entry.id ? previous : cur)));
        onError(e);
      });
    },
    [onError],
  );

  const addListEntry = useCallback(
    async (itemId: string, text: string) => {
      const id = randomId();
      const position = entries.filter((e) => e.itemId === itemId).length;
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
      setEntries((prev) => [...prev, temp]);
      try {
        const saved = await apiAddEntry(id, itemId, text);
        setEntries((prev) => prev.map((e) => (e.id === id ? saved : e)));
      } catch (e) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
        onError(e);
        throw e;
      }
    },
    [boardId, entries, onError],
  );

  return {
    board,
    members,
    items,
    entries,
    loading,
    error,
    reload,
    createItem,
    editItem,
    setPinned,
    setDone,
    keepLonger,
    moveItem,
    removeItem,
    restoreItem,
    toggleEntry,
    addListEntry,
  };
}

export async function fetchRemovedItems(boardId: string): Promise<ItemWithAuthor[]> {
  return getRemovedItems(boardId);
}

/** Apply a delta: upsert changed items, drop deleted/expired ones. */
function mergeDeltaItems(
  prev: ItemWithAuthor[],
  delta: ItemWithAuthor[],
  resolve: (item: ItemWithAuthor, previous?: ItemWithAuthor) => ItemWithAuthor,
): ItemWithAuthor[] {
  const byId = new Map(prev.map((i) => [i.id, i]));
  for (const item of delta) {
    const expired =
      item.deletedAt !== null ||
      (item.keepUntil !== null && new Date(item.keepUntil) <= new Date());
    if (expired) byId.delete(item.id);
    else byId.set(item.id, resolve(item, byId.get(item.id)));
  }
  return [...byId.values()];
}
