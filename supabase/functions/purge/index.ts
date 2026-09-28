// Edge Function: purge (docs/plan.md §10). Service-role only (invoked by
// pg_cron via pg_net). Nightly, it:
//   1. hard-deletes items soft-deleted > 30 days ago (and their photos);
//   2. hard-deletes boards soft-deleted > 30 days ago (cascade);
//   3. sweeps orphan photo files older than 24h;
//   4. sweeps avatar files that are no longer a user's current avatar.
// It stops starting new work after ~100s and reports partial results via
// `timedOut`, so a huge backlog degrades to several nights instead of a
// platform timeout.
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { authorized } from '../_shared/auth.ts';

const PHOTOS = 'board-photos';
const AVATARS = 'avatars';
const ORPHAN_HOURS = 24;
const BATCH = 1000;
const CHUNK = 100; // per storage/`in()` request, to stay within URL/body limits
const DEADLINE_MS = 100_000; // stop starting new work after ~100s
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Obj = { path: string; createdAt: number };

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Every object in a bucket, recursing folders; carries created_at so callers
 *  don't need a second List() per file. */
async function listAll(admin: SupabaseClient, bucket: string, prefix = ''): Promise<Obj[]> {
  const out: Obj[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 100, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id == null) {
        out.push(...(await listAll(admin, bucket, path)));
      } else {
        out.push({ path, createdAt: entry.created_at ? Date.parse(entry.created_at) : Date.now() });
      }
    }
    if (data.length < 100) break;
    offset += data.length;
  }
  return out;
}

/** Remove storage objects in chunks; throw on the first failure (never
 *  proceed as if it worked). */
async function removeObjects(admin: SupabaseClient, bucket: string, paths: string[]): Promise<number> {
  let removed = 0;
  for (const part of chunk(paths, CHUNK)) {
    const { error } = await admin.storage.from(bucket).remove(part);
    if (error) throw new Error(`storage remove failed (${bucket}): ${error.message}`);
    removed += part.length;
  }
  return removed;
}

Deno.serve(async (req: Request) => {
  if (!authorized(req)) return new Response('forbidden', { status: 403 });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
  const deadline = Date.now() + DEADLINE_MS;
  const outOfTime = () => Date.now() > deadline;
  let timedOut = false;

  try {
    // --- 1. Purge expired items (batched) -------------------------------
    let purged = 0;
    for (let batch = 0; batch < 50; batch++) {
      if (outOfTime()) {
        timedOut = true;
        break;
      }
      const { data: stale, error } = await admin.rpc('expired_for_purge', { p_limit: BATCH });
      if (error) throw new Error(`expired_for_purge failed: ${error.message}`);
      if (!stale || stale.length === 0) break;
      const paths = stale.map((i) => i.photo_path).filter((p): p is string => !!p);
      if (paths.length > 0) await removeObjects(admin, PHOTOS, paths);
      const { error: delError } = await admin.rpc('purge_items', {
        p_ids: stale.map((i) => i.id),
      });
      if (delError) throw new Error(`purge_items failed: ${delError.message}`);
      purged += stale.length;
      if (stale.length < BATCH) break;
    }

    // --- 2. Boards soft-deleted > 30 days ago, with no items left -------
    let boardsDeleted: number | null = 0;
    if (outOfTime()) {
      timedOut = true;
    } else {
      const { data, error: boardError } = await admin.rpc('purge_boards');
      if (boardError) throw new Error(`purge_boards failed: ${boardError.message}`);
      boardsDeleted = data ?? 0;
    }

    // --- 3. Orphan photos ------------------------------------------------
    // Paths and their authoritative row count arrive from one snapshot; abort
    // if they disagree (a truncated list would delete live photos).
    type InUseSnapshot = { paths: string[]; total: number | string };
    const { data: inUseRows, error: inUseError } = await admin.rpc('photo_paths_in_use');
    if (inUseError) throw new Error(`photo_paths_in_use failed: ${inUseError.message}`);
    const snapshot = ((inUseRows ?? []) as InUseSnapshot[])[0];
    const used = new Set<string>(snapshot?.paths ?? []);
    const total = Number(snapshot?.total ?? 0);
    if (used.size !== total) {
      throw new Error(`in-use path count mismatch (${used.size} vs ${total})`);
    }
    const orphanCutoff = Date.now() - ORPHAN_HOURS * 3600 * 1000;
    let orphans = 0;
    if (outOfTime()) {
      timedOut = true;
    } else {
      const toRemove = (await listAll(admin, PHOTOS))
        .filter((o) => !used.has(o.path) && o.createdAt <= orphanCutoff)
        .map((o) => o.path);
      if (toRemove.length > 0) {
        orphans = await removeObjects(admin, PHOTOS, toRemove);
        // Drop the accounting rows for the objects just deleted, so quota
        // stops counting bytes that no longer exist (the hourly sweep would
        // otherwise keep them up to 25h past expiry).
        for (const part of chunk(toRemove, CHUNK)) {
          const { error: intentError } = await admin
            .from('photo_upload_intents')
            .delete()
            .in('path', part);
          if (intentError) throw new Error(`intent cleanup failed: ${intentError.message}`);
        }
      }
    }

    // --- 4. Avatar files that are no longer a user's current avatar ------
    // Removes avatars of deleted accounts AND stale/replaced files for living
    // users. Avatars should be uploaded as <user_id>/avatar.jpg with upsert;
    // any other object under a folder is unreferenced and can go. Replaced
    // files get the same 24h age cutoff as orphan photos — the referenced
    // profile row may briefly lag a fresh upload. Only well-formed ids hit
    // the profiles lookup: a non-uuid folder would throw 22P02 on the uuid
    // cast and 500 the whole run.
    const avatarObjects = await listAll(admin, AVATARS);
    const folders = [...new Set(avatarObjects.map((o) => o.path.split('/')[0]).filter(Boolean))];
    const avatarCutoff = Date.now() - ORPHAN_HOURS * 3600 * 1000;
    let avatars = 0;
    for (const part of chunk(folders, CHUNK)) {
      if (outOfTime()) {
        timedOut = true;
        break;
      }
      const ids = part.filter((id) => UUID_RE.test(id));
      const current = new Map<string, string | null>();
      if (ids.length > 0) {
        const { data: existing, error } = await admin
          .from('profiles')
          .select('id, avatar_path')
          .in('id', ids);
        if (error) throw new Error(`profiles read failed: ${error.message}`);
        for (const p of existing ?? []) current.set(p.id, p.avatar_path as string | null);
      }
      const stale = avatarObjects
        .filter((o) => {
          const uid = o.path.split('/')[0];
          if (!part.includes(uid)) return false;
          if (!UUID_RE.test(uid)) return true; // junk folder: can never be referenced
          if (!current.has(uid)) return true; // account no longer exists
          return o.path !== current.get(uid) && o.createdAt <= avatarCutoff;
        })
        .map((o) => o.path);
      if (stale.length > 0) avatars += await removeObjects(admin, AVATARS, stale);
    }

    return Response.json({ purged, boards: boardsDeleted ?? 0, orphans, avatars, timedOut });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : String(e), { status: 500 });
  }
});
