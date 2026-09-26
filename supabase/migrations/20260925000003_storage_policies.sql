-- Phase 3 (docs/plan.md §7): private photo + avatar storage.
--
-- board-photos/<board_id>/<item_id>/<uuid>.jpg — readable by that board's
-- members. WRITES: none for client roles. The only writer is the upload-photo
-- Edge Function (service role, bypasses RLS): it decodes the upload, rejects
-- non-images, downsizes, re-encodes as JPEG (stripping EXIF/GPS), and records
-- byte_size — so arbitrary bytes can never land in the bucket. Clients get
-- their path from start_photo_upload and send raw bytes to the function.
-- Deletion is the purge job's job (service role).
--
-- avatars/<user_id>/<uuid>.jpg — readable by the user and by anyone who
-- shares a board with them, writable only by the owning user.

-- Safe board-id extraction: malformed paths return null (deny), never error.
create function public._path_board_id(p_path text)
returns uuid
language sql
immutable
set search_path = '' as $$
  select case
    when split_part(p_path, '/', 1)
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_path, '/', 1)::uuid
    else null
  end;
$$;

-- Someone whose board list includes p_user (shares at least one board).
create function public._shares_board_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = '' as $$
  select exists (
    select 1
    from public.board_members me
    join public.board_members them on them.board_id = me.board_id
    where me.user_id = auth.uid() and them.user_id = p_user
  );
$$;

-- ---------------------------------------------------------------------------
-- board-photos
-- ---------------------------------------------------------------------------

drop policy if exists "board_photos_member_read" on storage.objects;
create policy "board_photos_member_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'board-photos'
    and public.is_member(public._path_board_id(name))
  );

-- No INSERT/UPDATE/DELETE policies on board-photos for any client role:
-- the upload-photo Edge Function writes with the service role (bypassing
-- RLS), and the purge job deletes the same way. A direct client upload is
-- denied even with a live intent path.
drop policy if exists "board_photos_member_upload" on storage.objects;

-- ---------------------------------------------------------------------------
-- avatars
-- ---------------------------------------------------------------------------

drop policy if exists "avatars_shared_read" on storage.objects;
create policy "avatars_shared_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      split_part(name, '/', 1) = auth.uid()::text
      or (
        split_part(name, '/', 1)
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and public._shares_board_with(split_part(name, '/', 1)::uuid)
      )
    )
  );

drop policy if exists "avatars_owner_write" on storage.objects;
create policy "avatars_owner_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
    and owner = auth.uid()
  );

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
    and owner = auth.uid()
  )
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
    and owner = auth.uid()
  );
