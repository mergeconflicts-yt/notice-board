import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, turnstileSiteKey } from '../lib/supabase';
import { LargeSecureStore } from '../lib/secureStore';
import { friendlyMessage, updateProfile } from '../lib/api';
import { User } from '../types';

type SessionStatus = 'loading' | 'ready' | 'offline' | 'needsCaptcha' | 'expired';

type SessionState = {
  status: SessionStatus;
  user: User | null;
  error: string | null;
  init: (captchaToken?: string) => Promise<void>;
  setDisplayName: (displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
};

/**
 * True when a *usable* Supabase session blob is in storage (any project ref).
 * Reads through the encrypted store so a corrupt/legacy value is discarded
 * (and reported as absent) rather than counted as a live session.
 */
async function hasStoredSession(): Promise<boolean> {
  const keys = await AsyncStorage.getAllKeys();
  const key = keys.find((k) => k.endsWith('-auth-token'));
  if (!key) return false;
  try {
    return (await LargeSecureStore.getItem(key)) != null;
  } catch {
    // Keychain temporarily unavailable (e.g. device locked). Assume a session
    // exists so we never fall through to creating a new user.
    return true;
  }
}

// Offline auto-retry with backoff (2s → 4s → … capped at 30s).
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 2000;

function clearRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  retryDelay = 2000;
}

/** A real connectivity failure (as opposed to an invalid/expired session). */
function isNetworkError(error: unknown): boolean {
  const e = error as { name?: string; message?: string } | undefined;
  if (!e) return false;
  return e.name === 'AuthRetryableFetchError' || /fetch|network|timeout|internet/i.test(e.message ?? '');
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void useSession.getState().init();
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, 30000);
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
    clearRetry();
    set({ status: 'loading', error: null });
    try {
      // Capture this BEFORE getUser(): a failed refresh makes the Supabase
      // library delete the stored session, so checking afterwards would find
      // nothing and wrongly sign in a brand-new user.
      const stored = await hasStoredSession();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!user) {
        // A stored session means we already have an identity. Never replace it
        // automatically — a brand-new anonymous user would lose every board
        // (docs/plan.md §8.3).
        if (stored) {
          if (isNetworkError(userError)) {
            // Connectivity problem: keep the session, retry with backoff.
            set({ status: 'offline', error: 'Can\'t reach the board. Check your connection.' });
            scheduleRetry();
            return;
          }
          // The stored session is unusable (deleted user, bad token, 401/403):
          // don't retry forever — offer an explicit sign out.
          set({
            status: 'expired',
            error: 'Your session has expired.',
          });
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
      // Only connectivity failures are worth retrying; anything else (a
      // rejected sign-in, a captcha error) shows offline without a loop.
      if (isNetworkError(e)) {
        set({ status: 'offline', error: 'Can\'t reach the board. Check your connection.' });
        scheduleRetry();
      } else {
        set({ status: 'offline', error: friendlyMessage(e) });
      }
    }
  },

  setDisplayName: async (displayName) => {
    // Keep the existing avatar; renaming must not clear it.
    const current = useSession.getState().user;
    const user = await updateProfile(displayName, current?.avatarPath ?? null);
    set({ user });
  },

  signOut: async () => {
    clearRetry();
    await supabase.auth.signOut();
    set({ user: null, status: 'loading', error: null });
  },
}));
