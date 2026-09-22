import { create } from 'zustand';
import { User } from '../types';
import { getBackend } from '../services';

type SessionStatus = 'loading' | 'needsIdentity' | 'ready';

type SessionState = {
  status: SessionStatus;
  user: User | null;
  mode: 'supabase' | 'local';
  init: () => Promise<void>;
  setIdentity: (displayName: string, avatar?: string | null) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
};

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  user: null,
  mode: 'local',

  init: async () => {
    const backend = getBackend();
    try {
      const user = await backend.init();
      set({ user, status: user ? 'ready' : 'needsIdentity', mode: backend.mode });
    } catch (err) {
      console.error('session init failed', err);
      set({ status: 'needsIdentity', mode: backend.mode });
    }
  },

  setIdentity: async (displayName, avatar) => {
    const backend = getBackend();
    const user = await backend.ensureUser(displayName, avatar);
    set({ user, status: 'ready' });
  },

  updateDisplayName: async (displayName) => {
    const backend = getBackend();
    const user = await backend.ensureUser(displayName);
    set({ user });
  },
}));
