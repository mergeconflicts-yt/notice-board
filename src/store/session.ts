import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, turnstileSiteKey } from '../lib/supabase';
import { friendlyMessage, updateProfile } from '../lib/api';
import { User } from '../types';

type SessionStatus = 'loading' | 'ready' | 'offline' | 'needsCaptcha';

type SessionState = {
  status: SessionStatus;
  user: User | null;
  error: string | null;
  init: (captchaToken?: string) => Promise<void>;
  setDisplayName: (displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
};

/** True when a Supabase session blob is present in storage (any project ref). */
async function hasStoredSession(): Promise<boolean> {
  const keys = await AsyncStorage.getAllKeys();
  return keys.some((k) => k.endsWith('-auth-token'));
}



async function loadProfile(id: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    displayName: data.display_name,
    avatarPath: data.avatar_path,
    createdAt: data.created_at,
  };
}

/**
 * Session bootstrap (docs/plan.md §8.3): reuse a stored session, sign in
 * anonymously only when there is genuinely none, and never mint a new user
 * because a refresh failed on a flaky network.
 */
export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  user: null,
  error: null,

  init: async (captchaToken) => {
    set({ status: 'loading', error: null });
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // A stored session means we already have an identity. Never replace it
        // automatically — a brand-new anonymous user would lose every board
        // (docs/plan.md §8.3). Only a genuinely absent session starts fresh;
        // clearing a bad session is the user's explicit choice (Sign out).
        if (await hasStoredSession()) {
          set({ status: 'offline', error: 'Can\'t reach the board. Check your connection.' });
          return;
        }
        // Production needs a Turnstile token; ask the UI to collect one first.
        if (turnstileSiteKey && !captchaToken) {
          set({ status: 'needsCaptcha', error: null });
          return;
        }
        const { error } = await supabase.auth.signInAnonymously({
          options: captchaToken ? { captchaToken } : undefined,
        });
        if (error) throw error;
      }

      const {
        data: { user: current },
      } = await supabase.auth.getUser();
      if (!current) throw new Error('not_authenticated');
      const profile = await loadProfile(current.id);
      set({
        user:
          profile ?? {
            id: current.id,
            displayName: 'Someone',
            avatarPath: null,
            createdAt: current.created_at ?? new Date().toISOString(),
          },
        status: 'ready',
        error: null,
      });
    } catch (e) {
      const message =
        e instanceof Error && /fetch|network|timeout/i.test(e.message)
          ? 'Can\'t reach the board. Check your connection.'
          : friendlyMessage(e);
      set({ status: 'offline', error: message });
    }
  },

  setDisplayName: async (displayName) => {
    // Keep the existing avatar; renaming must not clear it.
    const current = useSession.getState().user;
    const user = await updateProfile(displayName, current?.avatarPath ?? null);
    set({ user });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, status: 'loading', error: null });
  },
}));
