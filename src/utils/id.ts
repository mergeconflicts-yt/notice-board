const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6)
  );
}

/**
 * Deterministic pseudo-random generator seeded by a string.
 * Returns a float in [0, 1). Used to give notes a stable color/rotation.
 */
export function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += h << 13;
    h ^= h >>> 7;
    h += h << 3;
    h ^= h >>> 17;
    h += h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

export function generateInviteCode(): string {
  let out = '';
  const rand = seeded(randomId() + Date.now().toString());
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  }
  return out;
}

export function normalizeInviteCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]+/g, '');
}
