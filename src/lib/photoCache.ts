import {
  cacheDirectory,
  deleteAsync,
  downloadAsync,
  getInfoAsync,
  makeDirectoryAsync,
  readAsStringAsync,
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
 */

const DIR_NAME = 'board-photo-cache';
// Photos are ~300–600 KB; 150 MB holds a large family history with margin.
const MAX_BYTES = 150 * 1024 * 1024;
const INDEX_NAME = 'index.json';

type IndexEntry = { size: number; savedAt: number };
type Index = Record<string, IndexEntry>;

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
      typeof (e as IndexEntry).size === 'number' &&
      typeof (e as IndexEntry).savedAt === 'number',
  );
}

async function readIndex(): Promise<Index> {
  try {
    const info = await getInfoAsync(indexUri());
    if (!info.exists) return {};
    const parsed: unknown = JSON.parse(await readAsStringAsync(indexUri()));
    return isIndex(parsed) ? parsed : {};
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

/** Delete oldest-first until the cache fits the cap; unknown sizes are
 *  re-measured, missing files just drop their accounting. */
async function sweep(): Promise<void> {
  const index = await readIndex();
  const rows = Object.entries(index).sort((a, b) => a[1].savedAt - b[1].savedAt);
  let total = 0;
  const sizes = new Map<string, number>();
  for (const [storagePath, e] of rows) {
    let size = e.size;
    if (!(size > 0)) {
      try {
        const info = await getInfoAsync(`${dirUri()}${fileNameFor(storagePath)}`);
        size = info.exists && typeof info.size === 'number' ? info.size : 0;
      } catch {
        size = 0;
      }
    }
    sizes.set(storagePath, size);
    total += size;
  }
  const kept: Index = {};
  for (const [storagePath] of rows) kept[storagePath] = index[storagePath];
  for (const [storagePath] of rows) {
    if (total <= MAX_BYTES) break;
    try {
      await deleteAsync(`${dirUri()}${fileNameFor(storagePath)}`, { idempotent: true });
    } catch {
      // Already gone (OS purge) — just drop the accounting below.
    }
    total -= sizes.get(storagePath) ?? 0;
    delete kept[storagePath];
  }
  await writeIndex(kept);
}

/**
 * Local `file://` URI for a board-photos storage path, downloading once via
 * a fresh signed URL on cache miss. Returns null when the photo genuinely
 * can't be fetched (offline/missing) so callers render their fallback.
 * Concurrent callers for the same path share one download.
 */
export async function cachedPhotoUri(storagePath: string): Promise<string | null> {
  const pending = inFlight.get(storagePath);
  if (pending) return pending;
  const run = (async (): Promise<string | null> => {
    try {
      const info = await getInfoAsync(dirUri());
      if (!info.exists) await makeDirectoryAsync(dirUri(), { intermediates: true });
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
      const index = await readIndex();
      let size = 0;
      try {
        const written = await getInfoAsync(dest);
        size = written.exists && typeof written.size === 'number' ? written.size : 0;
      } catch {
        size = 0;
      }
      index[storagePath] = { size, savedAt: Date.now() };
      await writeIndex(index);
      void sweep();
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
  try {
    await deleteAsync(`${dirUri()}${fileNameFor(storagePath)}`, { idempotent: true });
  } catch {
    // Already gone — accounting cleanup below still applies.
  }
  const index = await readIndex();
  if (index[storagePath]) {
    delete index[storagePath];
    await writeIndex(index);
  }
}
