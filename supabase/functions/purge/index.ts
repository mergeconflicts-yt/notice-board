// Edge Function: purge (docs/plan.md §10). Service-role only (invoked by
// pg_cron via pg_net). Nightly, it:
//   1. hard-deletes items soft-deleted > 30 days ago (and their photos);
//   2. hard-deletes boards soft-deleted > 30 days ago (cascade);
//   3. sweeps orphan photo files older than 24h;
//   4. deletes avatars belonging to accounts that no longer exist.
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { authorized } from '../_shared/auth.ts';

const PHOTOS = 'board-photos';
const AVATARS = 'avatars';
const ORPHAN_HOURS = 24;
const BATCH = 1000;
const CHUNK = 100; // per storage/`in()` request, to stay within URL/body limits

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

async function requireCount(query: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const { count, error } = await query;
  if (error || count == null) throw new Error('count query failed');
  return count;
}

Deno.serve(async (req: Request) => {
  if (!authorized(req)) return new Response('forbidden', { status: 403 });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  try {
    // --- 1. Purge expired items (batched) -------------------------------
    let purged = 0;
    for (let batch = 0; batch < 50; batch++) {
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
    const { data: boardsDeleted, error: boardError } = await admin.rpc('purge_boards');
    if (boardError) throw new Error(`purge_boards failed: ${boardError.message}`);

    // --- 3. Orphan photos ------------------------------------------------
    // One call for every in-use path; abort if it doesn't match the exact
    // count (a truncated list would delete live photos).
    const { data: inUse, error: inUseError } = await admin.rpc('photo_paths_in_use');
    if (inUseError) throw new Error(`photo_paths_in_use failed: ${inUseError.message}`);
    const exact = await requireCount(
      admin.from('items').select('id', { count: 'exact', head: true }).not('photo_path', 'is', null),
    );
    if ((inUse ?? []).length !== exact) {
      throw new Error(`in-use path count mismatch (${(inUse ?? []).length} vs ${exact})`);
    }
    const used = new Set<string>(inUse ?? []);
    const orphanCutoff = Date.now() - ORPHAN_HOURS * 3600 * 1000;
    const toRemove = (await listAll(admin, PHOTOS))
      .filter((o) => !used.has(o.path) && o.createdAt <= orphanCutoff)
      .map((o) => o.path);
    const orphans = toRemove.length > 0 ? await removeObjects(admin, PHOTOS, toRemove) : 0;

    // --- 4. Avatar files that are no longer a user's current avatar ------
    // Removes avatars of deleted accounts AND stale/replaced files for living
    // users. Avatars should be uploaded as <user_id>/avatar.jpg with upsert;
    // any other object under a folder is unreferenced and can go.
    const avatarObjects = await listAll(admin, AVATARS);
    const folders = [...new Set(avatarObjects.map((o) => o.path.split('/')[0]).filter(Boolean))];
    let avatars = 0;
    for (const part of chunk(folders, CHUNK)) {
      const { data: existing, error } = await admin
        .from('profiles')
        .select('id, avatar_path')
        .in('id', part);
      if (error) throw new Error(`profiles read failed: ${error.message}`);
      const current = new Map(
        (existing ?? []).map((p) => [p.id, p.avatar_path as string | null]),
      );
      const stale = avatarObjects
        .filter((o) => {
          const uid = o.path.split('/')[0];
          if (!part.includes(uid)) return false;
          if (!current.has(uid)) return true; // account no longer exists
          return o.path !== current.get(uid); // replaced / older file
        })
        .map((o) => o.path);
      if (stale.length > 0) avatars += await removeObjects(admin, AVATARS, stale);
    }

    return Response.json({ purged, boards: boardsDeleted ?? 0, orphans, avatars });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : String(e), { status: 500 });
  }
});
