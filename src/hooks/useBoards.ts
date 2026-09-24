import { useCallback, useEffect, useState } from 'react';
import { friendlyMessage, getMyBoards } from '../lib/api';
import { useSession } from '../store/session';
import { Board } from '../types';

/** The caller's boards (RLS returns only boards they belong to). Loads only
 *  once the session is ready, and reloads when the signed-in user changes. */
export function useMyBoards() {
  const status = useSession((s) => s.status);
  const userId = useSession((s) => s.user?.id ?? null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBoards(await getMyBoards());
      setError(null);
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Don't query before there's a session to query with.
    if (status !== 'ready' || !userId) return;
    let alive = true;
    void (async () => {
      try {
        const next = await getMyBoards();
        if (!alive) return;
        setBoards(next);
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
  }, [status, userId]);

  const reload = useCallback(() => {
    setLoading(true);
    return load();
  }, [load]);

  return { boards, loading, error, reload };
}
