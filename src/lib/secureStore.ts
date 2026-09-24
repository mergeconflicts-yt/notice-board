import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { decryptJson, encryptJson, fromHex, toHex } from './sessionCrypto';

/**
 * LargeSecureStore (docs/plan.md §8): the Supabase session often exceeds
 * SecureStore's ~2KB limit, so the AES key lives in SecureStore and the
 * encrypted values live in AsyncStorage. The key never leaves the keychain.
 *
 * Values include the session object AND the PKCE code verifier (a JSON
 * string), so any valid JSON is accepted — see sessionCrypto.isJson.
 */
const KEY_ID = 'notice.session.key';

// The default ("when unlocked") makes a background token refresh throw while
// the phone is locked, so the rotated refresh token is never saved. Allow
// access after the first unlock instead.
const KEY_OPTS = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

/** Thrown when the keychain is unavailable (e.g. the device is locked). The
 *  session store treats this as retryable, never as "something went wrong". */
export class KeychainError extends Error {
  constructor() {
    super('keychain_unavailable');
    this.name = 'KeychainError';
  }
}

// Memoised first write, so two concurrent writes can't create two keys.
let keyPromise: Promise<Uint8Array> | null = null;

/**
 * Read-only key access. Returns null when no key is stored; THROWS on a
 * keychain error (e.g. the device is locked during a background launch). It
 * never creates a key — doing so on a read would make an already-encrypted
 * value undecryptable.
 */
async function readKey(): Promise<Uint8Array | null> {
  let existing: string | null;
  try {
    existing = await SecureStore.getItemAsync(KEY_ID, KEY_OPTS);
  } catch {
    throw new KeychainError();
  }
  return existing ? fromHex(existing) : null;
}

/** Create a key — used only on a write, and only when none exists yet. */
async function createKey(): Promise<Uint8Array> {
  const key = Crypto.getRandomBytes(32);
  try {
    await SecureStore.setItemAsync(KEY_ID, toHex(key), KEY_OPTS);
  } catch {
    keyPromise = null;
    throw new KeychainError();
  }
  return key;
}

/** The key for a write: existing if present, else a single shared new key. */
async function getKeyForWrite(): Promise<Uint8Array> {
  const existing = await readKey();
  if (existing) return existing;
  if (!keyPromise) keyPromise = createKey();
  return keyPromise;
}

export const LargeSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    // NOTE: readKey() may throw on a keychain error. Let it propagate — the
    // value must NOT be deleted just because the keychain was unavailable.
    const aesKey = await readKey();
    if (aesKey == null) {
      // Ciphertext with no key: unrecoverable (not a keychain error). Drop it.
      await AsyncStorage.removeItem(key);
      return null;
    }
    const decrypted = decryptJson(aesKey, encrypted);
    if (decrypted == null) {
      // Malformed/legacy/corrupt value: drop it rather than crash.
      await AsyncStorage.removeItem(key);
      return null;
    }
    return decrypted;
  },

  async setItem(key: string, value: string): Promise<void> {
    // Only create a key when none exists — never replace an existing one, and
    // never on the read path. Memoised so two first writes agree on one key.
    const aesKey = await getKeyForWrite();
    // Fresh random IV per write: reusing a counter would let two saved
    // values be combined to recover the tokens.
    await AsyncStorage.setItem(key, encryptJson(aesKey, value, Crypto.getRandomBytes(16)));
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};
