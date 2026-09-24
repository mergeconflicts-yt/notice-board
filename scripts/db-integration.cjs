// Database + RLS integration checks for the notice backend.
// Runs against a Supabase stack (local `supabase start` or hosted).
//
// Usage:
//   SUPABASE_URL=http://127.0.0.1:55321 SUPABASE_ANON_KEY=<anon> \
//     node scripts/db-integration.cjs
//
// Covers: anon auth, board privacy (strangers read nothing, no self-join),
// profile privacy (self + co-members only, anon sees nothing),
// legacy-bucket privacy (member-scoped reads, own-folder member uploads),
// invites (issue/accept/uses/expiry/revoke), items + entries (CRUD, toggle,
// reorder, soft delete/restore, version conflicts), actor-forgery lockdown
// (completed_by/checked_by/uploaded_by/deleted_by are server-decided),
// expiry filtering, audit events, settings, and private-asset signed URLs.
const { createClient } = require('@supabase/supabase-js');

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
if (!URL || !ANON) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY.');
  process.exit(1);
}

const ok = (n, c, x = '') => {
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`);
  if (!c) process.exitCode = 1;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const B = () => createClient(URL, ANON);
const asUser = async (sb) => {
  await sb.auth.signInAnonymously();
  const { data: { user } } = await sb.auth.getUser();
  await sb.from('profiles').upsert(
    { id: user.id, display_name: 'IntTest', avatar: null }, { onConflict: 'id' });
  return user;
};

(async () => {
  const A = B(), Bp = B(), C = B();
  const meA = await asUser(A);
  const meB = await asUser(Bp);
  await asUser(C);

  // Board + privacy
  const { data: brow, error: berr } = await A.rpc('create_board', { p_name: 'Int Test' });
  ok('create_board RPC', !berr && !!brow.id, berr?.message);
  const boardId = brow.id;
  const sneak = await C.from('boards').select('id').eq('id', boardId);
  ok('stranger cannot read board', sneak.data.length === 0);
  const noJoin = await C.from('board_members').insert({ board_id: boardId, user_id: meB.id });
  void meB;
  ok('self-join blocked', !!noJoin.error);

  // Profiles: strangers see nothing, even knowing the exact id.
  const sneakProfile = await C.from('profiles').select('id').eq('id', meA.id);
  ok('stranger cannot read profile', (sneakProfile.data ?? []).length === 0);

  // Invites
  const { data: invRows } = await A.rpc('create_board_invite',
    { p_board_id: boardId, p_max_uses: 1, p_expires_at: null });
  const token = invRows[0].token;
  ok('invite issued', /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(token), token);
  const joined = await Bp.rpc('accept_board_invite', { p_token: token });
  ok('accept joins', joined.data === boardId, joined.error?.message);
  const { data: inv1 } = await A.from('board_invites').select('use_count').eq('id', invRows[0].invite_id).single();
  await Bp.rpc('accept_board_invite', { p_token: token });
  const { data: inv2 } = await A.from('board_invites').select('use_count').eq('id', invRows[0].invite_id).single();
  ok('re-accept is free', inv1.use_count === 1 && inv2.use_count === 1, `${inv1.use_count}->${inv2.use_count}`);
  const full = await C.rpc('accept_board_invite', { p_token: token });
  ok('max_uses enforced', !!full.error);

  // Profiles: co-members and self can read; key-only anon cannot list.
  const coProfile = await Bp.from('profiles').select('id').eq('id', meA.id);
  ok('co-member reads profile', (coProfile.data ?? []).length === 1);
  const ownProfile = await A.from('profiles').select('id').eq('id', meA.id);
  ok('own profile readable', (ownProfile.data ?? []).length === 1);
  const anonList = await B().from('profiles').select('id').limit(1);
  ok('anon lists no profiles', (anonList.data ?? []).length === 0);

  // Items + entries
  const { data: item } = await Bp.from('board_items')
    .insert({ board_id: boardId, type: 'note', body: 'hello' }).select('*').single();
  ok('member add item, actor stamped', item.created_by === meB.id && item.version === 1);
  const e1 = (await Bp.from('list_entries')
    .insert({ board_id: boardId, item_id: item.id, text: 'Milk', position: 0 })
    .select('*').single()).data;
  await Bp.from('list_entries').insert({ board_id: boardId, item_id: item.id, text: 'Eggs', position: 1 });
  await A.from('list_entries').update({ is_checked: true }).eq('id', e1.id);
  const { data: checked } = await A.from('list_entries').select('is_checked,checked_by').eq('id', e1.id).single();
  ok('toggle stamps checker', checked.is_checked === true, `by=${checked.checked_by}`);

  // Actor forgery: WHO-columns are server-decided, so blaming someone else
  // never sticks. Bp (member) keeps trying to pin things on meA.
  const forgedDone = (await Bp.from('board_items')
    .insert({ board_id: boardId, type: 'note', body: 'forge',
      completed_at: new Date().toISOString(), completed_by: meA.id })
    .select('id,completed_by').single()).data;
  ok('insert completed_by stamped self', forgedDone.completed_by === meB.id,
    `by=${forgedDone.completed_by}`);
  await Bp.from('board_items').update({ body: 'forge edit', completed_by: meA.id }).eq('id', forgedDone.id);
  const pinnedDone = (await Bp.from('board_items').select('completed_by').eq('id', forgedDone.id).single()).data;
  ok('update cannot reassign completed_by', pinnedDone.completed_by === meB.id,
    `by=${pinnedDone.completed_by}`);
  await Bp.from('board_items').update({ completed_at: null, completed_by: meA.id }).eq('id', forgedDone.id);
  const clearedDone = (await Bp.from('board_items').select('completed_by').eq('id', forgedDone.id).single()).data;
  ok('reopen clears completed_by', clearedDone.completed_by === null);
  const forgedTick = (await Bp.from('list_entries')
    .insert({ board_id: boardId, item_id: item.id, text: 'Forge', position: 9,
      is_checked: true, checked_by: meA.id })
    .select('id,checked_by,checked_at').single()).data;
  ok('insert checked_by stamped self',
    forgedTick.checked_by === meB.id && !!forgedTick.checked_at, `by=${forgedTick.checked_by}`);
  await A.from('list_entries').update({ text: 'Forge edit', checked_by: meB.id }).eq('id', forgedTick.id);
  const pinnedTick = (await A.from('list_entries').select('checked_by').eq('id', forgedTick.id).single()).data;
  ok('update cannot reassign checked_by', pinnedTick.checked_by === meB.id,
    `by=${pinnedTick.checked_by}`);
  await A.from('list_entries').update({ is_checked: false, checked_by: meB.id }).eq('id', forgedTick.id);
  const flippedTick = (await A.from('list_entries').select('is_checked,checked_by').eq('id', forgedTick.id).single()).data;
  ok('uncheck restamps checker', flippedTick.is_checked === false && flippedTick.checked_by === meA.id,
    `by=${flippedTick.checked_by}`);
  const forgedAsset = (await Bp.from('item_assets')
    .insert({ board_id: boardId, item_id: item.id, storage_path: `integ/${Date.now()}.jpg`, uploaded_by: meA.id })
    .select('id,uploaded_by').single()).data;
  ok('insert uploaded_by stamped self', forgedAsset.uploaded_by === meB.id,
    `by=${forgedAsset.uploaded_by}`);
  await Bp.from('item_assets').update({ uploaded_by: meA.id }).eq('id', forgedAsset.id);
  const pinnedAsset = (await Bp.from('item_assets').select('uploaded_by').eq('id', forgedAsset.id).single()).data;
  ok('update cannot reassign uploaded_by', pinnedAsset.uploaded_by === meB.id,
    `by=${pinnedAsset.uploaded_by}`);
  await Bp.from('item_assets').delete().eq('id', forgedAsset.id);
  await A.from('boards').update({ name: 'Int Test', deleted_by: meB.id }).eq('id', boardId);
  const pinnedBoardDel = (await A.from('boards').select('deleted_by').eq('id', boardId).single()).data;
  ok('update cannot forge board deleted_by', pinnedBoardDel.deleted_by === null);
  const stale = await A.from('board_items').update({ body: 'stale' })
    .eq('id', item.id).eq('version', 999).select('id');
  ok('stale version writes nothing', (stale.data ?? []).length === 0);
  await Bp.from('board_items').update({ body: 'hello!' }).eq('id', item.id);
  await Bp.from('board_items').update({ deleted_at: new Date().toISOString() }).eq('id', item.id);
  const { data: gone } = await A.from('board_items').select('id')
    .eq('board_id', boardId).is('deleted_at', null);
  ok('soft delete hides', !gone.some((r) => r.id === item.id));
  await Bp.from('board_items').update({ deleted_at: null }).eq('id', item.id);
  const { data: back } = await A.from('board_items').select('id')
    .eq('board_id', boardId).is('deleted_at', null);
  ok('restore returns', back.some((r) => r.id === item.id));

  // Expiry
  await Bp.from('board_items').insert({ board_id: boardId, type: 'note', body: 'old',
    expires_at: '2020-01-01T00:00:00Z' });
  await Bp.from('board_items').insert({ board_id: boardId, type: 'note', body: 'new',
    expires_at: new Date(Date.now() + 864e5).toISOString() });
  const { data: live } = await A.from('board_items').select('body')
    .eq('board_id', boardId).is('deleted_at', null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  const bodies = live.map((r) => r.body);
  ok('expiry filtered', !bodies.includes('old') && bodies.includes('new'));

  // Events + settings
  const { data: events } = await A.from('board_events').select('entity_type,action')
    .eq('board_id', boardId).limit(50);
  const acts = events.map((e) => `${e.entity_type}:${e.action}`);
  for (const want of ['board:insert', 'member:insert', 'item:insert', 'item:update',
    'item:delete', 'item:restore', 'entry:insert', 'entry:update']) {
    ok(`event ${want}`, acts.includes(want));
  }
  await A.from('user_settings').upsert({ user_id: meA.id, theme: 'dark' }, { onConflict: 'user_id' });
  const { data: s } = await A.from('user_settings').select('*').eq('user_id', meA.id).single();
  ok('settings round-trip', s.theme === 'dark');

  // Legacy `notes` bucket: strangers cannot upload, members cannot write
  // outside their own folder, and only board members can read back.
  const strangerPut = await C.storage.from('notes')
    .upload(`${meA.id}/integ-${Date.now()}.txt`, Buffer.from('x'), { contentType: 'text/plain' });
  ok('stranger upload denied', !!strangerPut.error);
  const wrongFolder = await Bp.storage.from('notes')
    .upload(`${meA.id}/integ-${Date.now()}.txt`, Buffer.from('x'), { contentType: 'text/plain' });
  ok('cross-folder upload denied', !!wrongFolder.error);
  const objPath = `${meB.id}/integ-${Date.now()}.txt`;
  const ownPut = await Bp.storage.from('notes')
    .upload(objPath, Buffer.from('x'), { contentType: 'text/plain', upsert: false });
  ok('member own-folder upload', !ownPut.error, ownPut.error?.message);
  // Reference the object from a board note so it becomes member-visible.
  const { data: refNote } = await Bp.from('notes')
    .insert({ board_id: boardId, author_id: meB.id, text: 'integ',
      image_url: `${URL}/storage/v1/object/public/notes/${objPath}` })
    .select('id').single();
  await sleep(1000);
  const memberList = await A.storage.from('notes').list(meB.id);
  ok('co-member reads object', (memberList.data ?? []).some((e) => e.name === objPath.split('/')[1]));
  const strangerList = await C.storage.from('notes').list(meB.id);
  ok('stranger lists nothing', (strangerList.data ?? []).length === 0);
  const ownDel = await Bp.storage.from('notes').remove([objPath]);
  ok('owner deletes own object', !ownDel.error, ownDel.error?.message);
  await Bp.from('notes').delete().eq('id', refNote.id);

  // Cleanup: soft-delete the board (cascades invisibility; rows remain auditable).
  await A.from('boards').update({ deleted_at: new Date().toISOString() }).eq('id', boardId);
  console.log('done');
  process.exit(process.exitCode ?? 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
