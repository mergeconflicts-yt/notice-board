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
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!auth.endsWith(serviceKey)) {
    return new Response('forbidden', { status: 403 });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  // --- Purge items removed beyond the retention window -------------------
  // The candidate query lives in SQL (testable) and runs with the service role.
  const { data: stale } = await admin.rpc('expired_for_purge');

  const paths = (stale ?? []).map((i) => i.photo_path).filter((p): p is string => !!p);
  let purged = 0;
  if (stale && stale.length > 0) {
    // Delete the bytes first; never drop the row if its file can't be removed.
    let storageOk = true;
    if (paths.length > 0) {
      const { error } = await admin.storage.from(BUCKET).remove(paths);
      storageOk = !error;
    }
    if (storageOk) {
      const ids = stale.map((i) => i.id);
      const { error } = await admin.from('items').delete().in('id', ids);
      if (!error) purged = ids.length;
    }
  }

  // --- Sweep orphan files older than the grace period --------------------
  let orphans = 0;
  const orphanCutoff = Date.now() - ORPHAN_HOURS * 3600 * 1000;
  for (const path of await listAll(admin)) {
    const { count } = await admin
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('photo_path', path);
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
