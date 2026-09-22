import { useCallback, useEffect, useMemo, useState } from 'react';
import { Board, MemberWithUser, NotePatch, NoteWithAuthor } from '../types';
import { getBackend } from '../services';
import { useSession } from '../store/session';
import { useDeletions } from '../store/deletions';
import { colorForNote, rotationForNote } from '../utils/note';
import { randomId } from '../utils/id';

export function useBoard(boardId: string) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    const backend = getBackend();
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
      await getBackend().updateBoard(boardId, { name });
    },
    [boardId],
  );

  const deleteBoard = useCallback(async () => {
    await getBackend().deleteBoard(boardId);
  }, [boardId]);

  const leaveBoard = useCallback(async () => {
    await getBackend().leaveBoard(boardId);
  }, [boardId]);

  return { board, loading, missing, updateName, deleteBoard, leaveBoard };
}

export type NewNoteInput = {
  text: string;
  imageUrl?: string | null;
  expiresAt?: string | null;
  kind?: NoteWithAuthor['kind'];
  data?: Record<string, unknown> | null;
  color?: NoteWithAuthor['color'];
  positionX?: number;
  positionY?: number;
};

export function useNotes(boardId: string) {
  const [notes, setNotes] = useState<NoteWithAuthor[] | null>(null);
  const [loading, setLoading] = useState(true);
  const user = useSession((s) => s.user);
  const pendingDeletes = useDeletions((s) => s.pending);

  useEffect(() => {
    let alive = true;
    const backend = getBackend();
    backend
      .getNotes(boardId)
      .then((n) => {
        if (!alive) return;
        setNotes(n);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    const unsub = backend.onNotesChanged(boardId, (n) => alive && setNotes(n));
    return () => {
      alive = false;
      unsub();
    };
  }, [boardId]);

  const addNote = useCallback(
    async (input: NewNoteInput) => {
      if (!user) throw new Error('Not signed in');
      const seed = randomId();
      const backend = getBackend();
      await backend.addNote({
        boardId,
        authorId: user.id,
        text: input.text.trim(),
        imageUrl: input.imageUrl ?? null,
        color: input.color ?? colorForNote(seed),
        rotation: rotationForNote(seed),
        positionX: input.positionX ?? 0.5,
        positionY: input.positionY ?? 0.5,
        kind: input.kind ?? 'note',
        data: input.data ?? null,
        expiresAt: input.expiresAt ?? null,
        completedAt: null,
      });
    },
    [boardId, user],
  );

  const updateNote = useCallback(
    async (id: string, patch: NotePatch) => {
      // Apply locally first so a dragged note stays where it was dropped
      // instead of snapping back until the backend echoes the change.
      setNotes((prev) =>
        prev ? prev.map((n) => (n.id === id ? { ...n, ...patch } : n)) : prev,
      );
      await getBackend().updateNote(id, patch);
    },
    [],
  );

  // Deleting is optimistic: the note vanishes now and is only removed from
  // the backend once the undo window lapses (see store/deletions).
  const deleteNote = useCallback(
    (id: string) => {
      useDeletions.getState().schedule(id, boardId);
    },
    [boardId],
  );

  const visibleNotes = useMemo(
    () => (notes ? notes.filter((n) => !pendingDeletes[n.id]) : notes),
    [notes, pendingDeletes],
  );

  return { notes: visibleNotes, loading, addNote, updateNote, deleteNote };
}

export function useBoards() {
  const [boards, setBoards] = useState<Board[]>([]);
  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);

  useEffect(() => {
    if (status !== 'ready' || !user) return;
    let alive = true;
    getBackend()
      .getBoards()
      .then((b) => alive && setBoards(b))
      .catch(() => alive && setBoards([]));
    return () => {
      alive = false;
    };
  }, [status, user]);

  return { boards };
}

export function useMembers(boardId: string) {
  const [members, setMembers] = useState<MemberWithUser[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const backend = getBackend();
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
