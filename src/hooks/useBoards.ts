import { useCallback, useEffect, useState } from 'react';
import { getMyBoards } from '../lib/api';
import { Board } from '../types';

/** The caller's boards (RLS returns only boards they belong to). */
export function useMyBoards() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setBoards(await getMyBoards());
    } catch {
      setBoards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const next = await getMyBoards();
        if (alive) setBoards(next);
      } catch {
        if (alive) setBoards([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    return load();
  }, [load]);

  return { boards, loading, reload };
}
