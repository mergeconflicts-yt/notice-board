-- Private board media. Objects live under board/<board_id>/item/<item_id>/…
-- and are visible only to that board's members. Served to clients exclusively
-- through signed URLs (see NoticeBackendV2.getAssetUrl).

insert into storage.buckets (id, name, public)
values ('board-media', 'board-media', false)
on conflict (id) do nothing;

-- Extracts the board id from a board-media path, or null when malformed
-- (so a bad path denies access instead of erroring the policy check).
create or replace function public._media_board_id(p_path text)
returns uuid
language sql immutable as $$
  select case
    when p_path ~ '^board/[0-9a-fA-F-]{36}/'
    then split_part(p_path, '/', 2)::uuid
    else null
  end;
$$;

drop policy if exists "board_media_member_read" on storage.objects;
create policy "board_media_member_read" on storage.objects
  for select using (
    bucket_id = 'board-media'
    and exists (
      select 1 from public.board_members bm
      where bm.board_id = public._media_board_id(storage.objects.name)
        and bm.user_id = auth.uid()
    )
  );

drop policy if exists "board_media_member_insert" on storage.objects;
create policy "board_media_member_insert" on storage.objects
  for insert with check (
    bucket_id = 'board-media'
    and exists (
      select 1 from public.board_members bm
      where bm.board_id = public._media_board_id(storage.objects.name)
        and bm.user_id = auth.uid()
    )
  );

drop policy if exists "board_media_member_update" on storage.objects;
create policy "board_media_member_update" on storage.objects
  for update using (
    bucket_id = 'board-media'
    and exists (
      select 1 from public.board_members bm
      where bm.board_id = public._media_board_id(storage.objects.name)
        and bm.user_id = auth.uid()
    )
  );

drop policy if exists "board_media_member_delete" on storage.objects;
create policy "board_media_member_delete" on storage.objects
  for delete using (
    bucket_id = 'board-media'
    and exists (
      select 1 from public.board_members bm
      where bm.board_id = public._media_board_id(storage.objects.name)
        and bm.user_id = auth.uid()
    )
  );
