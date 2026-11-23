import { create } from 'zustand';
import { getPaperOptions } from '../lib/api';
import { colors } from '../theme';
import type { PaperOption } from '../types';

/**
 * Paper styles available to a board, resolved once from live pack specs.
 * The composer shows the usable ones; the board resolves stored keys from the
 * same list, so a note keeps its paper even if its pack is later unavailable.
 */
type PapersState = {
  boardId: string | null;
  options: PaperOption[];
  loadedAt: number;
  loading: boolean;
  /** `maxAgeMs` 0 forces a refresh (used when the board regains focus). */
  load: (boardId: string, maxAgeMs?: number) => Promise<void>;
};

export const usePapers = create<PapersState>((set, get) => ({
  boardId: null,
  options: [],
  loadedAt: 0,
  loading: false,
  load: async (boardId, maxAgeMs = 30_000) => {
    const state = get();
    if (state.boardId === boardId && state.loading) return;
    if (state.boardId === boardId && Date.now() - state.loadedAt < maxAgeMs) return;
    set({ boardId, loading: true });
    try {
      const options = await getPaperOptions(boardId);
      if (get().boardId === boardId) {
        set({ options, loadedAt: Date.now(), loading: false });
      }
    } catch {
      if (get().boardId === boardId) set({ loading: false });
    }
  },
}));

/** The option for one stored `<packId>:<paperId>` key, or null for plain paper. */
export function usePaperOption(key: string | null | undefined): PaperOption | null {
  return usePapers((state) =>
    key ? (state.options.find((option) => option.key === key) ?? null) : null,
  );
}

/** The shape NotePaper's `paperStyle` prop expects. */
export function paperStyleFrom(option: PaperOption | null) {
  if (!option) return null;
  return {
    bg: option.bg,
    ink: option.ink,
    edge: colors.paperEdge,
    texture: option.texture,
    header: option.header,
  };
}
