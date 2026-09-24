// One-off: move legacy files out of the public `notes` bucket into the
// private `board-media` bucket, and point item_assets rows at the new paths.
//
// Usage:
//   SUPABASE_URL=http://127.0.0.1:55321 \
//   SUPABASE_SERVICE_ROLE_KEY=<key> \
//   node scripts/migrate-legacy-photos.cjs [--delete-bucket]
//
// How it works:
// - Lists every object in the `notes` bucket.
// - For each object, finds item_assets rows whose storage_path references it
//   (legacy public URL or bare path), downloads the bytes, re-uploads them to
//   board-media under board/<board_id>/item/<item_id>/<filename>, updates the
//   row, and deletes the old object.
// - Rows pointing at external URLs or local files (not in the bucket) are
//   left untouched and reported.
// - With --delete-bucket, removes the `notes` bucket once it is empty.
//   Otherwise it just reports; flip it private manually afterwards.
const { createClient } = require('@supabase/supabase-js');

const URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DELETE_BUCKET = process.argv.includes('--delete-bucket');

if (!URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const sb = createClient(URL, SERVICE_KEY);

async function listAll(bucket, prefix = '') {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
    });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id == null) {
        out.push(...(await listAll(bucket, path)));
      } else {
        out.push(path);
      }
    }
    if (data.length < 100) break;
    offset += data.length;
  }
  return out;
}

(async () => {
  const paths = await listAll('notes');
  console.log(`notes bucket objects: ${paths.length}`);

  let moved = 0;
  const skipped = [];
  for (const path of paths) {
    // Find asset rows referencing this object (public URL or bare path).
    const { data: rows, error } = await sb
      .from('item_assets')
      .select('id, board_id, item_id, storage_path');
    if (error) throw error;
    const refs = (rows ?? []).filter(
      (r) => r.storage_path === path || r.storage_path.endsWith(`/notes/${path}`),
    );
    if (refs.length === 0) {
      skipped.push(`${path} (unreferenced)`);
      continue;
    }
    const { data: bytes, error: dlErr } = await sb.storage.from('notes').download(path);
    if (dlErr) {
      skipped.push(`${path} (download failed: ${dlErr.message})`);
      continue;
    }
    for (const ref of refs) {
      const filename = path.split('/').pop();
      const dest = `board/${ref.board_id}/item/${ref.item_id}/${filename}`;
      const { error: upErr } = await sb.storage
        .from('board-media')
        .upload(dest, bytes, { upsert: true, contentType: 'image/jpeg' });
      if (upErr) {
        skipped.push(`${path} (upload failed: ${upErr.message})`);
        continue;
      }
      const { error: updErr } = await sb
        .from('item_assets')
        .update({ storage_path: dest })
        .eq('id', ref.id);
      if (updErr) {
        skipped.push(`${path} (row update failed: ${updErr.message})`);
        continue;
      }
      moved++;
    }
    const { error: rmErr } = await sb.storage.from('notes').remove([path]);
    if (rmErr) skipped.push(`${path} (old object not removed: ${rmErr.message})`);
  }

  console.log(`moved: ${moved}, skipped: ${skipped.length}`);
  for (const s of skipped) console.log('  -', s);

  if (DELETE_BUCKET) {
    const remaining = await listAll('notes');
    if (remaining.length === 0) {
      const { error } = await sb.storage.deleteBucket('notes');
      if (error) console.error('delete bucket failed:', error.message);
      else console.log('notes bucket deleted');
    } else {
      console.log(`bucket not empty (${remaining.length} objects left), kept`);
    }
  }
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
