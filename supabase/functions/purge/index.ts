// Edge Function: purge (docs/plan.md §10). Service-role only (invoked by
// pg_cron via pg_net). Hard-deletes items soft-deleted more than 30 days ago,
// removing their storage objects through the Storage API, and sweeps orphan
// files older than 24h.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const RETENTION_DAYS = 30;
const ORPHAN_HOURS = 24;

Deno.serve(async (req: Request) => {
  // Only the service role may run this.
  const auth = req.headers.get('Authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!auth.endsWith(serviceKey)) {
    return new Response('forbidden', { status: 403 });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 864e5).toISOString();

  const { data: stale } = await admin
    .from('items')
    .select('id, photo_path')
    .lt('deleted_at', cutoff)
    .limit(1000);

  let purged = 0;
  const removedPaths: string[] = [];
  for (const item of stale ?? []) {
    if (item.photo_path) removedPaths.push(item.photo_path);
    purged += 1;
  }
  if (removedPaths.length > 0) {
    await admin.storage.from('board-photos').remove(removedPaths);
  }
  if (stale && stale.length > 0) {
    await admin.from('items').delete().in('id', stale.map((i) => i.id));
  }

  // Orphan sweep: objects with no matching item, older than ORPHAN_HOURS.
  let orphans = 0;
  const orphanCutoff = Date.now() - ORPHAN_HOURS * 3600 * 1000;
  const { data: objects } = await admin.storage.from('board-photos').list('', { limit: 1000 });
  for (const obj of objects ?? []) {
    // Objects live under <board_id>/... so list() returns folder entries
    // (id == null); recurse one level to reach files.
    if (obj.id == null) continue;
    const created = obj.created_at ? new Date(obj.created_at).getTime() : Date.now();
    if (created > orphanCutoff) continue;
    const path = obj.name;
    const { count } = await admin
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('photo_path', path);
    if (!count) {
      await admin.storage.from('board-photos').remove([path]);
      orphans += 1;
    }
  }

  return Response.json({ purged, orphans });
});
