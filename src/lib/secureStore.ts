import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import aesjs from 'aes-js';

/**
 * LargeSecureStore (docs/plan.md §8): the Supabase session often exceeds
 * SecureStore's ~2KB limit, so the AES key lives in SecureStore and the
 * encrypted session lives in AsyncStorage. The key never leaves the keychain.
 */
const KEY_ID = 'notice.session.key';

const BYTE_TO_HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
const HEX_TO_BYTE: Record<string, number> = {};
for (let i = 0; i < 256; i++) HEX_TO_BYTE[BYTE_TO_HEX[i]] = i;

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += BYTE_TO_HEX[bytes[i]];
  return out;
}

function fromHex(hex: string): Uint8Array {
  const len = Math.floor(hex.length / 2);
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = HEX_TO_BYTE[hex.substring(i * 2, i * 2 + 2)] ?? 0;
  }
  return bytes;
}

function utf8ToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

async function getOrCreateKey(): Promise<Uint8Array> {
  const existing = await SecureStore.getItemAsync(KEY_ID);
  if (existing) return fromHex(existing);
  const key = Crypto.getRandomBytes(32);
  await SecureStore.setItemAsync(KEY_ID, toHex(key));
  return key;
}

/** Every value we store is a JSON session object. */
function looksLikeJson(value: string): boolean {
  const trimmed = value.trimStart();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

export const LargeSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    try {
      // Format is hex(iv[16] || ciphertext). Anything else (legacy plaintext,
      // old single-IV writes, corruption) is dropped so the app starts fresh
      // instead of reporting a phantom "offline".
      if (!/^[0-9a-fA-F]+$/.test(encrypted) || encrypted.length % 2 !== 0 || encrypted.length < 32) {
        await AsyncStorage.removeItem(key);
        return null;
      }
      const aesKey = await getOrCreateKey();
      const iv = fromHex(encrypted.slice(0, 32));
      const ciphertext = fromHex(encrypted.slice(32));
      const cipher = new aesjs.ModeOfOperation.ctr(aesKey, new aesjs.Counter(iv));
      const decrypted = bytesToUtf8(cipher.decrypt(ciphertext));
      if (!looksLikeJson(decrypted)) {
        await AsyncStorage.removeItem(key);
        return null;
      }
      return decrypted;
    } catch {
      // A rotated/damaged key or corrupt blob: drop it so the app can sign in
      // again rather than crashing on every launch.
      await AsyncStorage.removeItem(key);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const aesKey = await getOrCreateKey();
    // Fresh random IV per write: reusing a counter would let two saved
    // sessions be combined to recover the tokens.
    const iv = Crypto.getRandomBytes(16);
    const cipher = new aesjs.ModeOfOperation.ctr(aesKey, new aesjs.Counter(iv));
    const ciphertext = cipher.encrypt(utf8ToBytes(value));
    await AsyncStorage.setItem(key, toHex(iv) + toHex(ciphertext));
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};
