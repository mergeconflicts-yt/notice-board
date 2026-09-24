import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, turnstileSiteKey } from '../lib/supabase';
import { KeychainError, LargeSecureStore } from '../lib/secureStore';
import {
  deleteAccount as apiDeleteAccount,
  friendlyMessage,
  updateProfile,
} from '../lib/api';
import { User } from '../types';

type SessionStatus = 'loading' | 'ready' | 'offline' | 'needsCaptcha' | 'signedout';

type SessionState = {
  status: SessionStatus;
  user: User | null;
  error: string | null;
  init: (captchaToken?: string) => Promise<void>;
  setDisplayName: (displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Abandon a lost identity and start a fresh anonymous account. */
  startFresh: () => Promise<void>;
  /** Delete the account (board cleanup + auth user), keeping no marker. */
  deleteAccount: () => Promise<void>;
};

/** Durable note of the last signed-in user id, so a lost session never
 *  silently becomes a brand-new anonymous user. Written on every successful
 *  session, cleared only by an explicit Sign out / Delete account. */
const MARKER = 'notice.lastUserId';

// Offline auto-retry with backoff (2s → 4s → … capped at 30s).
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 2000;
// True while the app itself is signing out, so the auth listener doesn't treat
// it as a lost session.
let intentionalSignOut = false;

function clearRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  retryDelay = 2000;
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void useSession.getState().init();
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, 30000);
}

async function readMarker(): Promise<string | null> {
  return AsyncStorage.getItem(MARKER);
}
async function writeMarker(userId: string): Promise<void> {
  await AsyncStorage.setItem(MARKER, userId);
}
async function clearMarker(): Promise<void> {
  await AsyncStorage.removeItem(MARKER);
}

/** True when a Supabase session blob is in storage (any project ref). Reads
 *  through the encrypted store so a corrupt/legacy value counts as absent. */
async function hasStoredSession(): Promise<boolean> {
  const keys = await AsyncStorage.getAllKeys();
  const key = keys.find((k) => k.endsWith('-auth-token'));
  if (!key) return false;
  try {
    return (await LargeSecureStore.getItem(key)) != null;
  } catch (e) {
    // Keychain unavailable (device locked): surface it so init() retries
    // (offline) instead of proceeding.
    if (e instanceof KeychainError) throw e;
    // Any other error: assume a session exists so we never create a new user.
    return true;
  }
}

/** A failure worth retrying (connectivity, or a 429/5xx from the auth server)
 *  as opposed to an invalid/expired session. */
function isRetryable(error: unknown): boolean {
  const e = error as { name?: string; message?: string; status?: number } | undefined;
  if (!e) return false;
  if (e.name === 'AuthRetryableFetchError') return true;
  // Keychain temporarily unavailable (locked device) — retry, don't give up.
  if (e instanceof KeychainError || e.name === 'KeychainError') return true;
  if (e.status === 429 || (typeof e.status === 'number' && e.status >= 500)) return true;
  return /fetch|network|timeout|internet|too many requests/i.test(e.message ?? '');
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
 * anonymously only when this device has never held one, and never replace a
 * lost identity with a new user.
 */
export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  user: null,
  error: null,

  init: async (captchaToken) => {
    clearRetry();
    set({ status: 'loading', error: null });
    try {
      // Capture BEFORE getUser(): a failed refresh makes Supabase delete the
      // stored session, so checking afterwards would find nothing.
      const stored = await hasStoredSession();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!user) {
        const marker = await readMarker();
        if (stored || marker) {
          if (stored && isRetryable(userError)) {
            set({ status: 'offline', error: 'Can\'t reach the board. Check your connection.' });
            scheduleRetry();
            return;
          }
          // Identity existed but can't be restored: offer sign-in / start fresh
          // rather than silently creating a new user.
          set({
            status: 'signedout',
            error: 'Sign in to restore your boards.',
          });
          return;
        }
        // Genuine first launch.
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
      await writeMarker(current.id);
      const profile = await loadProfile(current.id);
      const isAnonymous = (current as { is_anonymous?: boolean }).is_anonymous === true;
      set({
        user: {
          ...(profile ?? {
            id: current.id,
            displayName: 'Someone',
            avatarPath: null,
            createdAt: current.created_at ?? new Date().toISOString(),
          }),
          isAnonymous,
        },
        status: 'ready',
        error: null,
      });
    } catch (e) {
      if (isRetryable(e)) {
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
    set({ user: { ...user, isAnonymous: current?.isAnonymous ?? false } });
  },

  signOut: async () => {
    clearRetry();
    intentionalSignOut = true;
    await clearMarker();
    await supabase.auth.signOut();
    set({ user: null, status: 'loading', error: null });
  },

  startFresh: async () => {
    // Explicitly abandon the old identity, then start anonymous.
    await clearMarker();
    await useSession.getState().init();
  },

  deleteAccount: async () => {
    intentionalSignOut = true;
    await clearMarker();
    await apiDeleteAccount();
  },
}));

// Keep the store in sync with the auth library. Registered once. A session
// removed by a failed refresh (SIGNED_OUT we didn't initiate) must NOT become a
// new user — surface the signed-out state instead.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    if (session?.user) {
      void writeMarker(session.user.id);
      void loadProfile(session.user.id)
        .then((profile) => {
          if (profile) {
            useSession.setState({
              user: { ...profile, isAnonymous: session.user.is_anonymous === true },
              status: 'ready',
              error: null,
            });
          }
        })
        .catch(() => {});
    }
    return;
  }
  if (event === 'SIGNED_OUT') {
    if (intentionalSignOut) {
      intentionalSignOut = false;
      return;
    }
    void readMarker().then((marker) => {
      if (marker) {
        useSession.setState({
          user: null,
          status: 'signedout',
          error: 'Sign in to restore your boards.',
        });
      }
    });
  }
});
