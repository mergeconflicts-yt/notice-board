// Edge Function: purge (docs/plan.md §10). Service-role only (invoked by
// pg_cron via pg_net). Nightly, it:
//   1. hard-deletes items soft-deleted > 30 days ago (and their photos);
//   2. sweeps orphan photo files older than 24h;
//   3. hard-deletes boards soft-deleted > 30 days ago (cascade);
//   4. deletes avatars belonging to accounts that no longer exist.
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PHOTOS = 'board-photos';
const AVATARS = 'avatars';
const RETENTION_DAYS = 30;
const ORPHAN_HOURS = 24;
const BATCH = 1000;

/** Every object path in a bucket, recursing through folders. */
async function listAll(admin: SupabaseClient, bucket: string, prefix = ''): Promise<string[]> {
  const out: string[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 100, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id == null) out.push(...(await listAll(admin, bucket, path)));
      else out.push(path);
    }
    if (data.length < 100) break;
    offset += data.length;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  const auth = req.headers.get('Authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  // Exact compare — an empty key must never let a caller through.
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return new Response('forbidden', { status: 403 });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 864e5).toISOString();

  // --- 1. Purge expired items (batched) ---------------------------------
  let purged = 0;
  for (let batch = 0; batch < 50; batch++) {
    const { data: stale, error } = await admin.rpc('expired_for_purge', { p_limit: BATCH });
    if (error) return new Response(`expired_for_purge failed: ${error.message}`, { status: 500 });
    if (!stale || stale.length === 0) break;
    const paths = stale.map((i) => i.photo_path).filter((p): p is string => !!p);
    if (paths.length > 0) {
      const { error: rmError } = await admin.storage.from(PHOTOS).remove(paths);
      if (rmError) return new Response(`storage remove failed: ${rmError.message}`, { status: 500 });
    }
    const { error: delError } = await admin.from('items').delete().in('id', stale.map((i) => i.id));
    if (delError) return new Response(`item delete failed: ${delError.message}`, { status: 500 });
    purged += stale.length;
    if (stale.length < BATCH) break;
  }

  // --- 2. Orphan photos: one query for all in-use paths, one pass over the
  //        bucket. Never sign/remove based on a per-file count. ----------
  const used = new Set<string>();
  for (let from = 0; ; from += BATCH) {
    const { data, error } = await admin
      .from('items')
      .select('photo_path')
      .not('photo_path', 'is', null)
      .range(from, from + BATCH - 1);
    if (error) return new Response(`items read failed: ${error.message}`, { status: 500 });
    for (const row of data ?? []) if (row.photo_path) used.add(row.photo_path);
    if (!data || data.length < BATCH) break;
  }
  let orphans = 0;
  const orphanCutoff = Date.now() - ORPHAN_HOURS * 3600 * 1000;
  const toRemove: string[] = [];
  for (const path of await listAll(admin, PHOTOS)) {
    if (used.has(path)) continue;
    const dir = path.split('/').slice(0, -1).join('/');
    const name = path.split('/').pop()!;
    const { data: info, error } = await admin.storage.from(PHOTOS).list(dir, { search: name, limit: 1 });
    if (error) continue; // don't delete on uncertainty
    const created = info?.[0]?.created_at ? new Date(info[0].created_at).getTime() : Date.now();
    if (created <= orphanCutoff) toRemove.push(path);
  }
  if (toRemove.length > 0) {
    const { error } = await admin.storage.from(PHOTOS).remove(toRemove);
    if (!error) orphans = toRemove.length;
  }

  // --- 3. Boards soft-deleted beyond the window (cascades to content) ---
  const { error: boardError } = await admin.from('boards').delete().lt('deleted_at', cutoff);
  if (boardError) return new Response(`board delete failed: ${boardError.message}`, { status: 500 });

  // --- 4. Avatars of accounts that no longer exist ---------------------
  let avatars = 0;
  const avatarPaths = await listAll(admin, AVATARS);
  const folders = new Set(avatarPaths.map((p) => p.split('/')[0]).filter(Boolean));
  for (const userId of folders) {
    const { count, error } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('id', userId);
    if (error) continue; // don't delete on uncertainty
    if (count && count > 0) continue;
    const owned = avatarPaths.filter((p) => p.startsWith(`${userId}/`));
    if (owned.length === 0) continue;
    const { error: rmError } = await admin.storage.from(AVATARS).remove(owned);
    if (!rmError) avatars += owned.length;
  }

  return Response.json({ purged, orphans, avatars });
});
