import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBackendV2 } from '../services';
import {
  BoardDetails,
  BoardInvite,
  BoardItemPatch,
  BoardItemWithAuthor,
  BoardMembership,
  CreatedInvite,
  ItemAsset,
  ListEntry,
  NotePatch,
  NoteWithAuthor,
} from '../types';
import { useSession } from '../store/session';
import { useToast } from '../store/toast';
import { colorForNote, parseListItems, rotationForNote } from '../utils/note';
import { adaptItemToNote } from '../utils/adapt';
import { randomId } from '../utils/id';

/** Input shape for adding a note (mirrors the composer output). */
export type BoardNoteInput = {
  text: string;
  imageUrl?: string | null;
  expiresAt?: string | null;
  kind?: NoteWithAuthor['kind'];
  data?: Record<string, unknown> | null;
  color?: NoteWithAuthor['color'];
};

export function useBoardDetails(boardId: string) {
  const [board, setBoard] = useState<BoardDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    const backend = getBackendV2();
    backend
      .getBoard(boardId)
      .then((b) => {
        if (!alive) return;
        setBoard(b);
        setMissing(!b);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    const unsub = backend.onBoardChanged(boardId, (b) => {
      if (!alive) return;
      setBoard(b);
      setMissing(!b);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [boardId]);

  const updateName = useCallback(
    async (name: string) => {
      await getBackendV2().updateBoard(boardId, { name });
    },
    [boardId],
  );

  const deleteBoard = useCallback(async () => {
    await getBackendV2().deleteBoard(boardId);
  }, [boardId]);

  const restoreBoard = useCallback(async () => {
    await getBackendV2().restoreBoard(boardId);
  }, [boardId]);

  const leaveBoard = useCallback(async () => {
    await getBackendV2().leaveBoard(boardId);
  }, [boardId]);

  return { board, loading, missing, updateName, deleteBoard, restoreBoard, leaveBoard };
}

export function useBoardMembers(boardId: string) {
  const [members, setMembers] = useState<BoardMembership[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const backend = getBackendV2();
    backend
      .getMembers(boardId)
      .then((m) => {
        if (!alive) return;
        setMembers(m);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    const unsub = backend.onMembersChanged(boardId, (m) => alive && setMembers(m));
    return () => {
      alive = false;
      unsub();
    };
  }, [boardId]);

  return { members, loading };
}

/** Resolve signed URLs per item, refreshing before they expire. */
function useSignedUrls(boardId: string, assets: ItemAsset[] | null) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!assets || assets.length === 0) return;
    let alive = true;
    const backend = getBackendV2();
    Promise.all(
      assets.map(async (a) => {
        try {
          const url = await backend.getAssetUrl(a, 3600);
          return [a.itemId, url] as const;
        } catch {
          return null;
        }
      }),
    ).then((pairs) => {
      if (!alive) return;
      const next: Record<string, string> = {};
      for (const p of pairs) {
        if (p && !(p[0] in next)) next[p[0]] = p[1];
      }
      setUrls(next);
    });
    const timer = setTimeout(() => setRefreshKey((k) => k + 1), 50 * 60 * 1000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [boardId, assets, refreshKey]);

  return urls;
}

export function useBoardNotes(boardId: string) {
  const [items, setItems] = useState<BoardItemWithAuthor[] | null>(null);
  const [entries, setEntries] = useState<ListEntry[] | null>(null);
  const [assets, setAssets] = useState<ItemAsset[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const backend = getBackendV2();
    Promise.all([
      backend.getItems(boardId),
      backend.getEntries(boardId),
      backend.getAssets(boardId),
    ])
      .then(([fetchedItems, fetchedEntries, fetchedAssets]) => {
        if (!alive) return;
        setItems(fetchedItems);
        setEntries(fetchedEntries);
        setAssets(fetchedAssets);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));

    const u1 = backend.onItemsChanged(boardId, (fetched) => alive && setItems(fetched));
    const u2 = backend.onEntriesChanged(boardId, (fetched) => alive && setEntries(fetched));
    const u3 = backend.onAssetsChanged(boardId, (fetched) => alive && setAssets(fetched));
    return () => {
      alive = false;
      u1();
      u2();
      u3();
    };
  }, [boardId]);

  const urls = useSignedUrls(boardId, assets);

  const notes = useMemo<NoteWithAuthor[] | null>(() => {
    if (!items) return null;
    const byItem = new Map<string, ListEntry[]>();
    for (const e of entries ?? []) {
      const arr = byItem.get(e.itemId);
      if (arr) arr.push(e);
      else byItem.set(e.itemId, [e]);
    }
    // Ignore cached URLs for assets that are gone, so a removed photo never
    // lingers on screen.
    const liveItems = new Set((assets ?? []).map((a) => a.itemId));
    return items.map((item) =>
      adaptItemToNote(
        item,
        byItem.get(item.id) ?? [],
        liveItems.has(item.id) ? (urls[item.id] ?? null) : null,
      ),
    );
  }, [items, entries, urls, assets]);

  const addNote = useCallback(
    async (input: BoardNoteInput) => {
      const backend = getBackendV2();
      const kind = input.kind ?? 'note';
      const color = input.color ?? colorForNote(randomId());
      const rotation = rotationForNote(randomId());
      const text = input.text.trim();
      const localImage = input.imageUrl && !input.imageUrl.startsWith('http') ? input.imageUrl : null;

      // Photos attach bytes to an item that must exist first.
      if (kind === 'photo' || localImage) {
        const item = await backend.addItem({
          boardId,
          type: 'photo',
          body: text || null,
          expiresAt: input.expiresAt ?? null,
          paper: { color, rotation },
        });
        if (localImage) {
          try {
            await backend.uploadAsset(boardId, item.id, localImage);
          } catch (e) {
            await backend.deleteItem(item.id).catch(() => {});
            throw e;
          }
        }
        return;
      }

      if (kind === 'list') {
        // One transactional call — the item plus its entries land together.
        const { title, items: parsed } = parseListItems(text);
        await backend.addListItem({
          boardId,
          body: title,
          expiresAt: input.expiresAt ?? null,
          paper: { color, rotation },
          entries: parsed.map((it, i) => ({ text: it.text, position: i, done: it.done })),
        });
        return;
      }

      const rawEventAt =
        kind === 'appointment'
          ? (input.data as { eventAt?: unknown } | null)?.eventAt
          : undefined;
      await backend.addItem({
        boardId,
        type: kind === 'appointment' ? 'date' : 'note',
        body: text,
        eventAt: typeof rawEventAt === 'string' ? rawEventAt : undefined,
        expiresAt: input.expiresAt ?? null,
        paper: { color, rotation },
      });
    },
    [boardId],
  );

  const updateNote = useCallback(
    async (id: string, patch: NotePatch) => {
      const backend = getBackendV2();
      const current = items?.find((n) => n.id === id);
      const itemPatch: BoardItemPatch = {};
      if (patch.text !== undefined) itemPatch.body = patch.text;
      if (patch.expiresAt !== undefined) itemPatch.expiresAt = patch.expiresAt;
      if (patch.completedAt !== undefined) itemPatch.completedAt = patch.completedAt;
      if (current && (patch.color !== undefined || patch.rotation !== undefined)) {
        itemPatch.paper = {
          ...current.paper,
          ...(patch.color !== undefined ? { color: patch.color } : {}),
          ...(patch.rotation !== undefined ? { rotation: patch.rotation } : {}),
        };
      }
      if (patch.positionX !== undefined || patch.positionY !== undefined) {
        itemPatch.layout = {
          x: patch.positionX ?? current?.layout?.x ?? 0.5,
          y: patch.positionY ?? current?.layout?.y ?? 0.5,
          manual: true,
        };
      }
      const rawEventAt = (patch.data as { eventAt?: unknown } | null)?.eventAt;
      if (typeof rawEventAt === 'string') itemPatch.eventAt = rawEventAt;

      // Apply locally first so a dragged note stays where it was dropped.
      setItems((prev) =>
        prev
          ? prev.map((n) =>
              n.id === id
                ? {
                    ...n,
                    body: itemPatch.body ?? n.body,
                    expiresAt: itemPatch.expiresAt ?? n.expiresAt,
                    completedAt: itemPatch.completedAt ?? n.completedAt,
                    eventAt: itemPatch.eventAt ?? n.eventAt,
                    paper: itemPatch.paper ? { ...n.paper, ...itemPatch.paper } : n.paper,
                    layout: itemPatch.layout !== undefined ? itemPatch.layout : n.layout,
                  }
                : n,
            )
          : prev,
      );
      await backend.updateItem(id, itemPatch);

      // A freshly attached photo still needs its bytes uploaded.
      if (patch.imageUrl && !patch.imageUrl.startsWith('http')) {
        await backend.uploadAsset(boardId, id, patch.imageUrl);
      }
    },
    [boardId, items],
  );

  const refreshItems = useCallback(async () => {
    try {
      setItems(await getBackendV2().getItems(boardId));
    } catch (e) {
      console.error('refresh items failed', e);
    }
  }, [boardId]);

  // In-flight soft-deletes, so Undo waits for its delete to land first and a
  // failed delete puts the note back instead of losing it.
  const pendingDeletes = useRef(new Map<string, Promise<void>>());

  const restoreNote = useCallback(async (id: string) => {
    const pending = pendingDeletes.current.get(id);
    if (pending) {
      try {
        await pending;
      } catch {
        // The delete itself failed; restoring is still safe to attempt.
      }
    }
    try {
      await getBackendV2().restoreItem(id);
    } catch (e) {
      console.error('restore failed', e);
    } finally {
      useToast.getState().hide();
    }
  }, []);

  const deleteNote = useCallback(
    (id: string) => {
      // Optimistic hide; the backend soft-deletes, so Undo restores in place.
      setItems((prev) => (prev ? prev.filter((n) => n.id !== id) : prev));
      const request = getBackendV2()
        .deleteItem(id)
        .then(
          () => {},
          (e) => {
            console.error('delete note failed', e);
            refreshItems();
          },
        );
      pendingDeletes.current.set(id, request);
      request.finally(() => {
        if (pendingDeletes.current.get(id) === request) pendingDeletes.current.delete(id);
      });
      useToast.getState().show('Note deleted', {
        label: 'Undo',
        onPress: () => restoreNote(id),
      });
    },
    [restoreNote, refreshItems],
  );

  // Persist a composer edit: item fields plus entry/asset reconciliation.
  const saveEdit = useCallback(
    async (noteId: string, input: BoardNoteInput) => {
      const backend = getBackendV2();
      const item = items?.find((n) => n.id === noteId);
      if (!item) throw new Error('Item not found');
      const kind = input.kind ?? 'note';
      const text = input.text.trim();
      const color = input.color ?? item.paper.color;

      if (kind === 'list' && item.type === 'list') {
        const { title, items: parsed } = parseListItems(text);
        await backend.updateItem(item.id, { body: title, paper: { ...item.paper, color } });
        const existing = (entries ?? [])
          .filter((e) => e.itemId === item.id)
          .sort((a, b) => a.position - b.position);
        const n = Math.max(existing.length, parsed.length);
        for (let i = 0; i < n; i++) {
          const old = existing[i];
          const next = parsed[i];
          if (old && next) {
            if (old.text !== next.text || old.isChecked !== next.done || old.position !== i) {
              await backend.updateEntry(old.id, {
                text: next.text,
                isChecked: next.done,
                position: i,
              });
            }
          } else if (next) {
            const created = await backend.addEntry({
              boardId,
              itemId: item.id,
              text: next.text,
              position: i,
            });
            if (next.done) await backend.updateEntry(created.id, { isChecked: true });
          } else if (old) {
            await backend.deleteEntry(old.id);
          }
        }
        return;
      }

      const rawEventAt =
        kind === 'appointment'
          ? (input.data as { eventAt?: unknown } | null)?.eventAt
          : undefined;
      await backend.updateItem(item.id, {
        body: text,
        eventAt: typeof rawEventAt === 'string' ? rawEventAt : undefined,
        expiresAt: input.expiresAt ?? null,
        paper: { ...item.paper, color },
      });

      const localImage =
        input.imageUrl && !input.imageUrl.startsWith('http') ? input.imageUrl : null;
      const currentAssets = (assets ?? []).filter((a) => a.itemId === item.id);
      if (localImage) {
        const uploaded = await backend.uploadAsset(boardId, item.id, localImage);
        for (const a of currentAssets) {
          if (a.id !== uploaded.id) await backend.deleteAsset(a.id).catch(() => {});
        }
      } else if (input.imageUrl == null) {
        for (const a of currentAssets) {
          await backend.deleteAsset(a.id).catch(() => {});
        }
      }
    },
    [boardId, items, entries, assets],
  );

  const toggleEntry = useCallback(
    async (itemId: string, index: number) => {
      const list = (entries ?? [])
        .filter((e) => e.itemId === itemId)
        .sort((a, b) => a.position - b.position);
      const target = list[index];
      if (!target) return;
      const next = !target.isChecked;
      setEntries((prev) =>
        prev ? prev.map((e) => (e.id === target.id ? { ...e, isChecked: next } : e)) : prev,
      );
      try {
        await getBackendV2().updateEntry(target.id, { isChecked: next });
      } catch (e) {
        console.error('toggle entry failed', e);
      }
    },
    [entries],
  );

  return { notes, loading, addNote, updateNote, deleteNote, restoreNote, toggleEntry, saveEdit };
}

export function useBoardsV2() {
  const [boards, setBoards] = useState<BoardDetails[]>([]);
  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);

  useEffect(() => {
    if (status !== 'ready' || !user) return;
    let alive = true;
    getBackendV2()
      .getBoards()
      .then((b) => alive && setBoards(b))
      .catch(() => alive && setBoards([]));
    return () => {
      alive = false;
    };
  }, [status, user]);

  return { boards };
}

export function useInvites(boardId: string) {
  const [invites, setInvites] = useState<BoardInvite[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      setInvites(await getBackendV2().getInvites(boardId));
    } catch {
      setInvites([]);
    }
  }, [boardId]);

  useEffect(() => {
    let alive = true;
    getBackendV2()
      .getInvites(boardId)
      .then((fetched) => alive && setInvites(fetched))
      .catch(() => alive && setInvites([]));
    return () => {
      alive = false;
    };
  }, [boardId]);

  const createInvite = useCallback(
    async (opts?: { maxUses?: number | null; expiresAt?: string | null }): Promise<CreatedInvite> => {
      const created = await getBackendV2().createInvite(boardId, opts);
      await refresh();
      return created;
    },
    [boardId, refresh],
  );

  const revokeInvite = useCallback(
    async (inviteId: string) => {
      await getBackendV2().revokeInvite(inviteId);
      await refresh();
    },
    [refresh],
  );

  return { invites, createInvite, revokeInvite, refresh };
}
