-- Close the two public-by-default reads.
--
-- 1. profiles: `using (true)` let anyone with the anon key enumerate every
--    user's name and avatar. Profiles are now visible only to the user
--    themselves and to members of a board they share — which covers every
--    in-app read (member lists, note attribution) without leaking strangers.
-- 2. The legacy `notes` photo bucket: world-readable, writable by any
--    signed-in user. The bucket goes private (public buckets bypass RLS, so
--    policies alone would not take effect) and access becomes membership
--    scoped: an object is readable only when a note on one of the caller's
--    boards references it, and uploads are limited to board members writing
--    their own folder. Owners may delete their own objects.
--
-- Consequence: legacy public photo URLs stop resolving until their bytes
-- are moved into board-media via scripts/migrate-legacy-photos.cjs (which
-- rewrites item_assets to signed URLs). That runbook — not this bucket —
-- is the supported photo path.

-- ---------------------------------------------------------------------------
-- profiles: self + co-members of a shared board only.
-- ---------------------------------------------------------------------------

drop policy if exists "profiles_read" on public.profiles;

create policy "profiles_member_read" on public.profiles
  for select using (
    auth.uid() = id
    or exists (
      select 1
      from public.board_members bm_me
      join public.board_members bm_other on bm_other.board_id = bm_me.board_id
      where bm_me.user_id = auth.uid()
        and bm_other.user_id = profiles.id
    )
  );

-- profiles_insert_own / profiles_update_own are unchanged (own row only).

-- ---------------------------------------------------------------------------
-- Legacy `notes` bucket: private + membership-scoped storage policies.
-- Object paths are `<uploader_uid>/<file>`; note image_urls end with
-- `/notes/<uploader_uid>/<file>`, which is how an object is tied back to
-- the boards whose members may read it.
-- ---------------------------------------------------------------------------

update storage.buckets
set public = false
where id = 'notes' and public = true;

drop policy if exists "notes_images_read" on storage.objects;

create policy "notes_images_member_read" on storage.objects
  for select using (
    bucket_id = 'notes'
    and exists (
      select 1
      from public.notes n
      where right(n.image_url, char_length(storage.objects.name) + 7)
            = '/notes/' || storage.objects.name
        and public.is_board_member(n.board_id)
    )
  );

drop policy if exists "notes_images_insert" on storage.objects;

create policy "notes_images_member_upload" on storage.objects
  for insert with check (
    bucket_id = 'notes'
    and auth.uid() is not null
    -- First path segment is the uploader's uid (uploads go to `<uid>/<file>`).
    and split_part(name, '/', 1) = auth.uid()::text
    and exists (
      select 1 from public.board_members bm where bm.user_id = auth.uid()
    )
  );

-- Owner-folder deletes, so test uploads (and users) can remove their own
-- objects. There is intentionally no update policy.
drop policy if exists "notes_images_owner_delete" on storage.objects;

create policy "notes_images_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'notes'
    and split_part(name, '/', 1) = auth.uid()::text
  );
