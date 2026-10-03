import {
  cacheDirectory,
  deleteAsync,
  downloadAsync,
  getInfoAsync,
  makeDirectoryAsync,
  readAsStringAsync,
  readDirectoryAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import { signedPhotoUrl } from './api';

/**
 * On-disk cache for board photos, keyed by STORAGE PATH (stable) instead of
 * signed URL (rotates every signing: new token + expiry each time).
 *
 * Why: expo-image caches by URI, so every re-sign (app start, foreground,
 * 12h refresh) used to re-download every photo on the board. Rendering the
 * cached `file://` URI instead means each photo downloads once and then
 * loads instantly — including offline — until evicted. OS cache purges and
 * missing files degrade to a re-download, never a blank that can't recover.
 *
 * Concurrency: every index read-modify-write (and the sweep) runs inside a
 * single promise-chain mutex, so concurrent downloads can't interleave and
 * silently drop each other's accounting. The sweep reconciles against an
 * actual directory listing, so files the OS purged (or wrote outside the
 * index) can't drift the cap.
 */

const DIR_NAME = 'board-photo-cache';
// Photos are ~300–600 KB; 150 MB holds a large family history with margin.
const MAX_BYTES = 150 * 1024 * 1024;
const INDEX_NAME = 'index.json';

type IndexEntry = {
  /** File name inside the cache dir (not derivable for adopted orphans). */
  file: string;
  size: number;
  savedAt: number;
};
type Index = Record<string, IndexEntry>;

// Serializes all index mutations and sweeps. Never rejects (a broken chain
// would wedge every later update).
let indexChain: Promise<void> = Promise.resolve();
function withIndex<T>(fn: () => Promise<T>): Promise<T> {
  const run = indexChain.then(fn);
  indexChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

const inFlight = new Map<string, Promise<string | null>>();

function dirUri(): string {
  return `${cacheDirectory}${DIR_NAME}/`;
}

function fileNameFor(storagePath: string): string {
  // Intent paths look like <uuid>/<uuid>/name.jpg — flatten to a safe name.
  return `${storagePath.replace(/[^a-zA-Z0-9]+/g, '_')}.jpg`;
}

function indexUri(): string {
  return `${dirUri()}${INDEX_NAME}`;
}

function isIndex(value: unknown): value is Index {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).every(
    (e) =>
      !!e &&
      typeof e === 'object' &&
      typeof (e as IndexEntry).file === 'string' &&
      typeof (e as IndexEntry).size === 'number' &&
      typeof (e as IndexEntry).savedAt === 'number',
  );
}

async function readIndex(): Promise<Index> {
  try {
    const info = await getInfoAsync(indexUri());
    if (!info.exists) return {};
    const parsed: unknown = JSON.parse(await readAsStringAsync(indexUri()));
    if (!isIndex(parsed)) return {};
    // Backfill for indexes written before `file` was tracked.
    for (const [k, e] of Object.entries(parsed)) {
      if (!e.file) e.file = fileNameFor(k);
    }
    return parsed;
  } catch {
    return {};
  }
}

async function writeIndex(index: Index): Promise<void> {
  try {
    await writeAsStringAsync(indexUri(), JSON.stringify(index));
  } catch {
    // Index loss only costs future eviction precision, never correctness.
  }
}

async function fileSize(name: string): Promise<number> {
  try {
    const info = await getInfoAsync(`${dirUri()}${name}`);
    return info.exists && typeof info.size === 'number' ? info.size : 0;
  } catch {
    return 0;
  }
}

/**
 * Reconcile the index with reality and delete oldest-first until the cache
 * fits the cap. Must run inside withIndex (it rewrites the whole index).
 */
async function sweepLocked(index: Index): Promise<Index> {
  let onDisk: Set<string>;
  try {
    onDisk = new Set(await readDirectoryAsync(dirUri()));
  } catch {
    return index;
  }
  const reconciled: Index = {};
  for (const [key, e] of Object.entries(index)) {
    if (onDisk.has(e.file)) reconciled[key] = e;
  }
  // Adopt files the index doesn't know (written around it, or resurrected
  // across an index loss): they count toward the cap under a file: key.
  for (const name of onDisk) {
    if (name === INDEX_NAME) continue;
    if (Object.values(reconciled).some((e) => e.file === name)) continue;
    let savedAt = Date.now();
    try {
      const info = await getInfoAsync(`${dirUri()}${name}`);
      if (info.exists && typeof info.modificationTime === 'number') {
        savedAt = info.modificationTime;
      }
    } catch {
      // Keep the now-stamp.
    }
    reconciled[`file:${name}`] = { file: name, size: await fileSize(name), savedAt };
  }
  const rows = Object.entries(reconciled).sort((a, b) => a[1].savedAt - b[1].savedAt);
  let total = 0;
  for (const [, e] of rows) {
    if (!(e.size > 0)) e.size = await fileSize(e.file);
    total += e.size;
  }
  const kept: Index = {};
  for (const [key, e] of rows) kept[key] = e;
  for (const [key, e] of rows) {
    if (total <= MAX_BYTES) break;
    try {
      await deleteAsync(`${dirUri()}${e.file}`, { idempotent: true });
    } catch {
      // Already gone — just drop the accounting below.
    }
    total -= e.size;
    delete kept[key];
  }
  await writeIndex(kept);
  return kept;
}

/**
 * Local `file://` URI for a board-photos storage path, downloading once via
 * a fresh signed URL on cache miss. Returns null when the photo genuinely
 * can't be fetched (offline/missing) so callers render their fallback.
 * Concurrent callers for the same path share one download; index updates
 * are serialized so concurrent paths can't lose each other's accounting.
 */
export async function cachedPhotoUri(storagePath: string): Promise<string | null> {
  const pending = inFlight.get(storagePath);
  if (pending) return pending;
  const run = (async (): Promise<string | null> => {
    try {
      const dirInfo = await getInfoAsync(dirUri());
      if (!dirInfo.exists) await makeDirectoryAsync(dirUri(), { intermediates: true });
      const dest = `${dirUri()}${fileNameFor(storagePath)}`;
      const hit = await getInfoAsync(dest);
      if (hit.exists) return dest;
      const url = await signedPhotoUrl(storagePath);
      if (!url) return null;
      const dl = await downloadAsync(url, dest);
      if (dl.status !== 200) {
        try {
          await deleteAsync(dest, { idempotent: true });
        } catch {
          // Partial file cleanup best-effort only.
        }
        return null;
      }
      await withIndex(async () => {
        const index = await readIndex();
        index[storagePath] = {
          file: fileNameFor(storagePath),
          size: await fileSize(fileNameFor(storagePath)),
          savedAt: Date.now(),
        };
        await sweepLocked(index);
      });
      return dest;
    } catch {
      return null;
    } finally {
      inFlight.delete(storagePath);
    }
  })();
  inFlight.set(storagePath, run);
  return run;
}

/**
 * Forget a cached photo (file + accounting). Called after a (re-)upload to
 * the same intent path overwrites the bytes server-side, so the next render
 * fetches fresh instead of showing the stale file.
 */
export async function dropCachedPhoto(storagePath: string): Promise<void> {
  inFlight.delete(storagePath);
  await withIndex(async () => {
    const index = await readIndex();
    const entry = index[storagePath];
    if (entry) {
      try {
        await deleteAsync(`${dirUri()}${entry.file}`, { idempotent: true });
      } catch {
        // Already gone — accounting cleanup below still applies.
      }
      delete index[storagePath];
      await writeIndex(index);
    }
  });
}

/**
 * Wipe the entire board-photo cache (files + index). Called whenever an
 * identity is abandoned — sign-out, account deletion, start-fresh — so one
 * account's private board photos never linger on disk for the next account
 * (or for anyone holding the unlocked device) until the OS happens to purge
 * the cache directory.
 */
export async function clearPhotoCache(): Promise<void> {
  inFlight.clear();
  await withIndex(async () => {
    let names: string[] = [];
    try {
      names = await readDirectoryAsync(dirUri());
    } catch {
      return;
    }
    for (const name of names) {
      try {
        await deleteAsync(`${dirUri()}${name}`, { idempotent: true });
      } catch {
        // Best-effort per file; a half-wiped cache still degrades to
        // re-downloads, and the OS may purge the directory itself.
      }
    }
    await writeIndex({});
  });
}
