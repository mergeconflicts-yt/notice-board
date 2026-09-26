-- Close the helper-function hole (docs/plan.md §5): Postgres grants EXECUTE to
-- PUBLIC by default, so every helper was callable over the API. The worst was
-- `invite_key()`, which returns the Vault invite key to any signed-in caller.
--
-- Helpers are only ever called by SECURITY DEFINER functions (which run as the
-- owner) or by triggers, so client roles need no access at all. The two
-- exceptions are the policy helpers `is_member` / `_path_board_id`: RLS and
-- storage policies execute as the caller, so `authenticated` must keep EXECUTE
-- on those — but anon/public must not.
--
-- `_shares_board_with` was only used by the avatars read policy; that check is
-- inlined below so the helper can be dropped entirely.

-- New functions default to no PUBLIC EXECUTE.
alter default privileges in schema public revoke execute on functions from public;

-- Internal helpers: no client role may call them.
revoke execute on function public.invite_key() from public, anon, authenticated;
revoke execute on function public.pick_invite_code() from public, anon, authenticated;
revoke execute on function public.normalise_invite_code(text) from public, anon, authenticated;
revoke execute on function public.hit_rate_limit(text, integer, interval) from public, anon, authenticated;
revoke execute on function public.run_list_lifetime(uuid) from public, anon, authenticated;
revoke execute on function public._consume_photo_intent(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.purge_stale_upload_intents() from public, anon, authenticated;
revoke execute on function public.promote_longest_member(uuid) from public, anon, authenticated;
revoke execute on function public.expire_items() from public, anon, authenticated;
revoke execute on function public.cleanup_rate_limits() from public, anon, authenticated;
revoke execute on function public.purge_stale_invites() from public, anon, authenticated;
revoke execute on function public.run_edge_job(text) from public, anon, authenticated;
revoke execute on function public.expired_for_purge(integer) from public, anon, authenticated;
revoke execute on function public.photo_paths_in_use() from public, anon, authenticated;
revoke execute on function public.purge_items(uuid[]) from public, anon, authenticated;
revoke execute on function public.purge_boards() from public, anon, authenticated;
revoke execute on function public.default_keep_until(item_type, timestamptz, boolean, timestamptz, text) from public, anon, authenticated;

-- Policy helpers: authenticated only (they run inside RLS/storage policies).
revoke execute on function public.is_member(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
revoke execute on function public._path_board_id(text) from public, anon;
grant execute on function public._path_board_id(text) to authenticated;

-- Inline the avatar sharing check so `_shares_board_with` can be removed.
-- Like profiles_select, only a shared *live* board exposes the avatar: a
-- stale membership on a soft-deleted board must not keep working.
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
        and exists (
          select 1
          from public.board_members me
          join public.board_members them on them.board_id = me.board_id
          join public.boards b on b.id = me.board_id
          where me.user_id = auth.uid()
            and them.user_id = split_part(name, '/', 1)::uuid
            and b.deleted_at is null
        )
      )
    )
  );

drop function if exists public._shares_board_with(uuid);
