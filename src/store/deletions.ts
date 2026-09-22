import { create } from 'zustand';
import { getBackend } from '../services';
import { useToast } from './toast';

/** How long the Undo toast stays up before the delete is committed (ms). */
export const UNDO_WINDOW_MS = 5000;

type PendingDelete = { boardId: string; timer: ReturnType<typeof setTimeout> };

type DeletionState = {
  /** Notes hidden from the board while their undo window is open. */
  pending: Record<string, PendingDelete>;
  schedule: (noteId: string, boardId: string) => void;
  undo: (noteId: string) => void;
  commit: (noteId: string) => void;
};

/**
 * Delete-with-undo for notes. The note is hidden immediately and only
 * removed from the backend once the undo window lapses, so pressing Undo
 * restores it in place without a round-trip.
 */
export const useDeletions = create<DeletionState>((set, get) => ({
  pending: {},

  schedule: (noteId, boardId) => {
    const existing = get().pending[noteId];
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => get().commit(noteId), UNDO_WINDOW_MS);
    set((s) => ({ pending: { ...s.pending, [noteId]: { boardId, timer } } }));
    useToast.getState().show(
      'Note deleted',
      { label: 'Undo', onPress: () => get().undo(noteId) },
      UNDO_WINDOW_MS,
    );
  },

  undo: (noteId) => {
    const entry = get().pending[noteId];
    if (!entry) return;
    clearTimeout(entry.timer);
    set((s) => {
      const pending = { ...s.pending };
      delete pending[noteId];
      return { pending };
    });
    useToast.getState().hide();
  },

  commit: (noteId) => {
    const entry = get().pending[noteId];
    if (!entry) return;
    clearTimeout(entry.timer);
    set((s) => {
      const pending = { ...s.pending };
      delete pending[noteId];
      return { pending };
    });
    getBackend()
      .deleteNote(noteId)
      .catch((e) => console.error('delete note failed', e));
  },
}));
