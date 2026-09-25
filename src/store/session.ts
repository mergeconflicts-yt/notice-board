import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { KeychainError, LargeSecureStore } from '../lib/secureStore';
import {
  deleteAccount as apiDeleteAccount,
  friendlyMessage,
  sendSignupCode,
  signInProvider,
  updateProfile,
  verifySignupCode,
} from '../lib/api';
import { User } from '../types';

type SessionStatus = 'loading' | 'ready' | 'offline' | 'signedout' | 'welcome' | 'name';

type SessionState = {
  status: SessionStatus;
  user: User | null;
  error: string | null;
  /** Whether the last-seen identity was anonymous; drives the signed-out
   *  wording (null when unknown). */
  markerAnon: boolean | null;
  init: (captchaToken?: string, manual?: boolean) => Promise<void>;
  /** Guest path: explicit anonymous sign-in, then the normal ready path. */
  continueAsGuest: (captchaToken?: string) => Promise<void>;
  /** Apple/Google path: provider sign-in, immediate name claim, then ready. */
  continueWithProvider: (provider: 'apple' | 'google') => Promise<void>;
  /** Email path: send the 6-digit code (no state change). */
  sendEmailCode: (email: string, captchaToken?: string) => Promise<void>;
  /** Email path: redeem the code, then the normal ready path. */
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  /** Arm the one-time "what's your name?" step for the next email sign-up. */
  beginNameCheck: () => void;
  /** Save the name from that step and continue. */
  completeName: (name: string) => Promise<void>;
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
// Single-flight: overlapping init() calls share one bootstrap, so two starts
// can't each create an anonymous user.
let inFlightInit: Promise<void> | null = null;
// Armed by the email sign-up flow: the next successful auth that lands on an
// unnamed account shows the one-time "what's your name?" step instead of ready.
let nameCheck = false;

/** Cancel a pending retry. Deliberately does NOT reset the backoff — init()
 *  runs on every retry, and resetting here made the delay stay at 2s forever. */
function clearRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

/** Full reset — only on a successful init or an explicit manual Retry. */
function resetRetry() {
  clearRetry();
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

type SessionMarker = { id: string; isAnonymous: boolean };

async function readMarker(): Promise<SessionMarker | null> {
  const raw = await AsyncStorage.getItem(MARKER);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SessionMarker>;
    if (parsed && typeof parsed.id === 'string') {
      return { id: parsed.id, isAnonymous: parsed.isAnonymous === true };
    }
  } catch {
    // Not JSON — fall through to the legacy bare-id handling below.
  }
  // Legacy bare-id marker (written before the flag existed): presence is all
  // we know. Keep the old meaning — it may belong to a linked account — so
  // sign-in stays offered.
  return raw.length > 0 ? { id: raw, isAnonymous: false } : null;
}
async function writeMarker(userId: string, isAnonymous: boolean): Promise<void> {
  await AsyncStorage.setItem(MARKER, JSON.stringify({ id: userId, isAnonymous }));
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

async function runInit(
  captchaToken: string | undefined,
  manual: boolean,
  set: (partial: Partial<SessionState>) => void,
): Promise<void> {
  if (manual) resetRetry();
  else clearRetry();
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
          markerAnon: marker?.isAnonymous ?? null,
        });
        return;
      }
      // Genuine first launch: show Welcome. Nothing signs in automatically
      // any more — every path (guest included) is an explicit choice there.
      set({ status: 'welcome', error: null });
      return;
    }

    const {
      data: { user: current },
    } = await supabase.auth.getUser();
    if (!current) throw new Error('not_authenticated');
    const isAnonymous = (current as { is_anonymous?: boolean }).is_anonymous === true;
    await writeMarker(current.id, isAnonymous);
    const profile = await loadProfile(current.id);
    // A successful bootstrap restores the default retry cadence.
    resetRetry();
    // Email sign-up has no provider name: ask once, then continue.
    const showName = nameCheck && !isAnonymous && (profile?.displayName ?? 'Someone') === 'Someone';
    if (showName) nameCheck = false;
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
      status: showName ? 'name' : 'ready',
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
  markerAnon: null,

  init: (captchaToken, manual = false) => {
    // Single-flight: a second start reuses the in-progress bootstrap instead
    // of racing it (which could create two anonymous users).
    if (inFlightInit) return inFlightInit;
    inFlightInit = runInit(captchaToken, manual, set).finally(() => {
      inFlightInit = null;
    });
    return inFlightInit;
  },

  continueAsGuest: async (captchaToken) => {
    const { error } = await supabase.auth.signInAnonymously({
      options: captchaToken ? { captchaToken } : undefined,
    });
    if (error) throw error;
    await useSession.getState().init();
  },

  continueWithProvider: async (provider) => {
    await signInProvider(provider);
    // Apple only sends the name on first sign-in — claim it immediately.
    // (handle_new_user already set it server-side; this is the fallback.)
    try {
      const {
        data: { user: fresh },
      } = await supabase.auth.getUser();
      const meta = fresh?.user_metadata as { full_name?: string; name?: string } | undefined;
      const name = (meta?.full_name?.trim() || meta?.name?.trim() || '').slice(0, 40).trim();
      if (fresh && name) {
        const profile = await loadProfile(fresh.id);
        if (!profile || profile.displayName === 'Someone') {
          await updateProfile(name);
        }
      }
    } catch {
      // Best effort only.
    }
    await useSession.getState().init();
  },

  sendEmailCode: async (email, captchaToken) => {
    await sendSignupCode(email, captchaToken);
  },

  verifyEmailCode: async (email, code) => {
    // Deliberately no init(): the auth listener takes over. If a name step is
    // armed it shows status 'name'; otherwise it goes straight to ready.
    await verifySignupCode(email, code);
    // The listener should have fired synchronously above; fall back to init
    // if it hasn't (e.g. a listener that defers).
    if (useSession.getState().status === 'welcome') await useSession.getState().init();
  },

  beginNameCheck: () => {
    nameCheck = true;
  },

  completeName: async (name) => {
    const current = useSession.getState().user;
    const user = await updateProfile(name);
    set({ user: { ...user, isAnonymous: current?.isAnonymous ?? false }, status: 'ready', error: null });
  },

  setDisplayName: async (displayName) => {
    // update_profile coalesces avatar_path, so renaming never clears it.
    const current = useSession.getState().user;
    const user = await updateProfile(displayName);
    set({ user: { ...user, isAnonymous: current?.isAnonymous ?? false } });
  },

  signOut: async () => {
    resetRetry();
    intentionalSignOut = true;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // Only drop the marker once the sign-out actually succeeded: a failed
      // sign-out must leave the stored identity for the next launch to offer
      // (rather than silently mint a new user).
      await clearMarker();
      set({ user: null, status: 'loading', error: null, markerAnon: null });
    } finally {
      // Always clear the flag — if it stayed set, the next real sign-out would
      // be mistaken for a lost session and ignored.
      intentionalSignOut = false;
    }
  },

  startFresh: async () => {
    // Explicitly abandon the old identity, then land on Welcome (no marker,
    // so init() offers the four options instead of minting a guest). The
    // stored session is removed locally only: if the server user is already
    // gone, a server round-trip 403s (user_not_found) while keeping the
    // stored session, and the next init() would land on the same dead identity.
    intentionalSignOut = true;
    try {
      await supabase.auth.signOut({ scope: 'local' });
      await clearMarker();
      await useSession.getState().init();
    } finally {
      intentionalSignOut = false;
    }
  },

  deleteAccount: async () => {
    intentionalSignOut = true;
    try {
      await apiDeleteAccount();
      // The account is gone: clear the marker so init() starts a fresh identity.
      await clearMarker();
    } finally {
      intentionalSignOut = false;
    }
  },
}));

// Keep the store in sync with the auth library. Registered once. A session
// removed by a failed refresh (SIGNED_OUT we didn't initiate) must NOT become a
// new user — surface the signed-out state instead.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    if (session?.user) {
      void writeMarker(session.user.id, session.user.is_anonymous === true);
      void loadProfile(session.user.id)
        .then((profile) => {
          if (profile) {
            const isAnon = session.user.is_anonymous === true;
            const showName = nameCheck && !isAnon && profile.displayName === 'Someone';
            if (showName) nameCheck = false;
            useSession.setState({
              user: { ...profile, isAnonymous: isAnon },
              status: showName ? 'name' : 'ready',
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
          markerAnon: marker.isAnonymous,
        });
      }
    });
  }
});
