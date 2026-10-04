import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { createStore, useStore } from 'zustand';
import { supabase } from '../lib/supabase';
import {
  ApiError,
  friendlyMessage,
  getDecorations,
  getPackArt,
  moveMagnet as apiMoveMagnet,
  NewMagnet,
  placeMagnet as apiPlaceMagnet,
  removeMagnet as apiRemoveMagnet,
} from '../lib/api';
import { useToast } from '../store/toast';
import { useSession } from '../store/session';
import { createBoardStoreRegistry, registerBoardStoreReset } from '../lib/boardStores';
import { Magnet, PackArt } from '../types';

function mapRealtimeMagnet(row: Record<string, unknown>): Magnet {
  return {
    id: row.id as string,
    boardId: row.board_id as string,
    artId: row.art_id as string,
    packId: row.pack_id as string,
    itemId: (row.item_id as string | null) ?? null,
    x: row.x as number,
    y: row.y as number,
    rotation: (row.rotation as number) ?? 0,
    z: row.z as number,
    placedBy: (row.placed_by as string | null) ?? null,
    giftNote: (row.gift_note as string | null) ?? null,
    version: (row.version as number) ?? 1,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? (row.created_at as string),
  };
}

/** The pack catalogue is global and rarely changes: fetch it once per session,
 *  not once per board store. */
let artCache: Promise<PackArt[]> | null = null;
function loadArt(): Promise<PackArt[]> {
  if (!artCache) {
    artCache = getPackArt().catch((e) => {
      artCache = null; // allow a retry after a failure
      throw e;
    });
  }
  return artCache;
}

export type DecorationsStore = {
  magnets: Magnet[];
  art: PackArt[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  place: (input: Omit<NewMagnet, 'boardId'>) => Promise<void>;
  move: (magnet: Magnet, x: number, y: number, itemId: string | null) => Promise<void>;
  remove: (magnet: Magnet) => Promise<void>;
};

type Internal = DecorationsStore;

const EMPTY = { magnets: [] as Magnet[], art: [] as PackArt[] };

function createDecorationsStore(boardId: string) {
  return createStore<Internal>((set, get) => {
    const onError = (e: unknown) => useToast.getState().show(friendlyMessage(e));

    return {
      ...EMPTY,
      loading: true,
      error: null,

      reload: async () => {
        try {
          const [{ magnets }, art] = await Promise.all([
            getDecorations(boardId),
            loadArt().catch(() => [] as PackArt[]),
          ]);
          set({ magnets, art, error: null });
        } catch (e) {
          if (e instanceof ApiError && (e.code === 'not_member' || e.code === 'not_authenticated')) {
            set({ ...EMPTY });
          } else {
            onError(e);
          }
          set({ error: friendlyMessage(e) });
        } finally {
          set({ loading: false });
        }
      },

      place: async (input) => {
        const me = useSession.getState().user;
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const temp: Magnet = {
          id: tempId,
          boardId,
          artId: input.artId,
          packId: get().art.find((a) => a.artId === input.artId)?.packId ?? 'starter',
          itemId: input.itemId ?? null,
          x: input.x,
          y: input.y,
          rotation: input.rotation ?? 0,
          z: Math.max(0, ...get().magnets.map((m) => m.z)) + 1,
          placedBy: me?.id ?? null,
          giftNote: input.giftNote ?? null,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ magnets: [...s.magnets, temp] }));
        try {
          const saved = await apiPlaceMagnet({ ...input, boardId });
          set((s) => ({ magnets: s.magnets.map((m) => (m.id === tempId ? saved : m)) }));
        } catch (e) {
          set((s) => ({ magnets: s.magnets.filter((m) => m.id !== tempId) }));
          onError(e);
          throw e;
        }
      },

      move: async (magnet, x, y, itemId) => {
        const previous = magnet;
        set((s) => ({
          magnets: s.magnets.map((m) =>
            m.id === magnet.id ? { ...m, x, y, itemId } : m,
          ),
        }));
        try {
          const saved = await apiMoveMagnet(magnet.id, x, y, itemId, magnet.version);
          set((s) => ({ magnets: s.magnets.map((m) => (m.id === magnet.id ? saved : m)) }));
        } catch (e) {
          // A lost version race: the other member's move won. Re-read rather
          // than snap back to a stale position.
          if (e instanceof ApiError && e.code === 'version_conflict') {
            await get().reload();
            return;
          }
          set((s) => ({ magnets: s.magnets.map((m) => (m.id === magnet.id ? previous : m)) }));
          onError(e);
          throw e;
        }
      },

      remove: async (magnet) => {
        const previous = get().magnets;
        set((s) => ({ magnets: s.magnets.filter((m) => m.id !== magnet.id) }));
        try {
          await apiRemoveMagnet(magnet.id);
        } catch (e) {
          set({ magnets: previous });
          onError(e);
          throw e;
        }
      },
    };
  });
}

function startDecorations(store: ReturnType<typeof createDecorationsStore>, boardId: string): () => void {
  void store.getState().reload();

  const topic = `decor:${boardId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
  const channel = supabase
    .channel(topic)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'board_magnets', filter: `board_id=eq.${boardId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as { id?: string };
          if (old?.id) {
            store.setState((s) => ({ magnets: s.magnets.filter((m) => m.id !== old.id) }));
          }
          return;
        }
        const mapped = mapRealtimeMagnet(payload.new as Record<string, unknown>);
        store.setState((s) => ({
          magnets: [...s.magnets.filter((m) => m.id !== mapped.id), mapped],
        }));
      },
    )
    .subscribe();

  const appSub = AppState.addEventListener('change', (next) => {
    if (next === 'active') void store.getState().reload();
  });

  return () => {
    void supabase.removeChannel(channel);
    appSub.remove();
  };
}

const registry = createBoardStoreRegistry<ReturnType<typeof createDecorationsStore>>();
registerBoardStoreReset(() => {
  registry.reset();
  artCache = null;
});

/** Shared per-board decorations store (magnets). */
export function useDecorations(boardId: string): DecorationsStore {
  const store = useMemo(
    () => registry.getOrCreate(boardId, () => createDecorationsStore(boardId)).store,
    [boardId],
  );
  const state = useStore(store);

  useEffect(
    () => registry.acquire(boardId, () => createDecorationsStore(boardId), startDecorations),
    [boardId],
  );

  return state;
}
