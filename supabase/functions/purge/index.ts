// Edge Function: purge (docs/plan.md §10). Service-role only (invoked by
// pg_cron via pg_net). Hard-deletes items soft-deleted more than 30 days ago
// and sweeps orphan files older than 24h.
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const BUCKET = 'board-photos';
const ORPHAN_HOURS = 24;

/** Every object path in the bucket, recursing through the board folders. */
async function listAll(admin: SupabaseClient, prefix = ''): Promise<string[]> {
  const out: string[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 100, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folders have no id; files do.
      if (entry.id == null) out.push(...(await listAll(admin, path)));
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

  // --- Purge items removed beyond the retention window -------------------
  // The candidate query lives in SQL (testable) and runs with the service
  // role. Batch until drained so a busy night isn't capped at one page.
  let purged = 0;
  for (let batch = 0; batch < 50; batch++) {
    const { data: stale, error: staleError } = await admin.rpc('expired_for_purge');
    if (staleError) {
      // Surface the failure instead of silently purging nothing.
      return new Response(`expired_for_purge failed: ${staleError.message}`, { status: 500 });
    }
    if (!stale || stale.length === 0) break;

    const paths = stale.map((i) => i.photo_path).filter((p): p is string => !!p);
    if (paths.length > 0) {
      // Delete the bytes first; never drop a row if its file can't be removed.
      const { error } = await admin.storage.from(BUCKET).remove(paths);
      if (error) {
        return new Response(`storage remove failed: ${error.message}`, { status: 500 });
      }
    }
    const ids = stale.map((i) => i.id);
    const { error: delError } = await admin.from('items').delete().in('id', ids);
    if (delError) {
      return new Response(`item delete failed: ${delError.message}`, { status: 500 });
    }
    purged += ids.length;
    if (stale.length < 1000) break;
  }

  // --- Sweep orphan files older than the grace period --------------------
  let orphans = 0;
  const orphanCutoff = Date.now() - ORPHAN_HOURS * 3600 * 1000;
  for (const path of await listAll(admin)) {
    const { count, error: useError } = await admin
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('photo_path', path);
    // If we can't tell whether the file is still referenced, keep it.
    if (useError) continue;
    if (count && count > 0) continue;
    // Only remove files older than the grace period.
    const dir = path.split('/').slice(0, -1).join('/');
    const name = path.split('/').pop()!;
    const { data: info } = await admin.storage.from(BUCKET).list(dir, { search: name, limit: 1 });
    const created = info?.[0]?.created_at ? new Date(info[0].created_at).getTime() : Date.now();
    if (created > orphanCutoff) continue;
    const { error } = await admin.storage.from(BUCKET).remove([path]);
    if (!error) orphans += 1;
  }

  return Response.json({ purged, orphans });
});
