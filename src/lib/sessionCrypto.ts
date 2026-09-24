import aesjs from 'aes-js';

/**
 * Pure helpers for the encrypted session store, kept free of Expo/RN imports
 * so they can be unit-tested. Values are AES-CTR, stored as hex(iv ‖ ct).
 */

const BYTE_TO_HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
const HEX_TO_BYTE: Record<string, number> = {};
for (let i = 0; i < 256; i++) HEX_TO_BYTE[BYTE_TO_HEX[i]] = i;

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += BYTE_TO_HEX[bytes[i]];
  return out;
}

export function fromHex(hex: string): Uint8Array {
  const len = Math.floor(hex.length / 2);
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = HEX_TO_BYTE[hex.substring(i * 2, i * 2 + 2)] ?? 0;
  }
  return bytes;
}

/**
 * A stored value is valid when it parses as JSON. This must accept ANY JSON,
 * not just objects: auth-js stores the PKCE code verifier as
 * `JSON.stringify("…")` (a JSON string starting with a quote).
 */
export function isJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

/** Encrypt a value → hex(iv ‖ ciphertext). */
export function encryptJson(key: Uint8Array, plaintext: string, iv: Uint8Array): string {
  const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(iv));
  return toHex(iv) + toHex(cipher.encrypt(new TextEncoder().encode(plaintext)));
}

/** Decrypt hex(iv ‖ ciphertext); null when malformed, corrupt, or not JSON. */
export function decryptJson(key: Uint8Array, stored: string): string | null {
  if (!/^[0-9a-fA-F]+$/.test(stored) || stored.length % 2 !== 0 || stored.length < 32) {
    return null;
  }
  try {
    const iv = fromHex(stored.slice(0, 32));
    const ciphertext = fromHex(stored.slice(32));
    const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(iv));
    const text = new TextDecoder().decode(cipher.decrypt(ciphertext));
    return isJson(text) ? text : null;
  } catch {
    return null;
  }
}
