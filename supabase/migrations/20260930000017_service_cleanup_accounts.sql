-- Service-only account cleanup for the nightly cleanup-users job.
--
-- The job used to pick inactive anonymous users who still belonged to boards
-- and then delete their auth user directly. Deleting the auth user cascades
-- to its profile and memberships (board_members.user_id is ON DELETE CASCADE),
-- which can leave a board with zero members but no deleted_at — an orphan no
-- client can see or remove — and it skipped the avatar cleanup that
-- delete_account performs.
--
-- This RPC does the same board tidy-up as delete_account(), for an arbitrary
-- target id, before the Edge Function deletes the auth user:
--   * boards where the target is the only member -> soft-deleted, invites
--     revoked;
--   * boards with others where the target is the last owner -> longest-standing
--     member promoted;
--   * target's memberships removed, avatar cleared.
-- It re-checks inactivity itself (same guard as is_inactive_anonymous_user),
-- so a board joined or session refreshed since the candidate query wins and
-- nothing is touched. Service role only; the auth user is still deleted by the
-- Edge Function (Postgres cannot safely delete auth.users).
-- ADD-ONLY migration (freeze in effect since the 2026-09-28 first push).

create function public.cleanup_anonymous_user(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = '' as $$
declare
  v_board record;
  v_was_owner boolean;
  v_remaining integer;
begin
  if p_id is null then
    raise exception 'invalid_input';
  end if;
  -- Re-check right before mutating: a board joined or a session refreshed
  -- since the candidate query must win.
  if not public.is_inactive_anonymous_user(p_id) then
    return false;
  end if;

  -- Lock the target's boards and read roles in one statement (same order and
  -- board-then-member sequence as delete_account/leave_board, so no deadlock).
  for v_board in
    select b.id as board_id, m.role
    from public.boards b
    join public.board_members m on m.board_id = b.id
    where m.user_id = p_id
    order by b.id
    for update of b
  loop
    v_was_owner := v_board.role = 'owner';
    delete from public.board_members
    where board_id = v_board.board_id and user_id = p_id;
    select count(*)::integer into v_remaining
    from public.board_members
    where board_id = v_board.board_id;
    if v_remaining = 0 then
      update public.boards
      set deleted_at = now(), updated_at = now()
      where id = v_board.board_id and deleted_at is null;
      update public.invites
      set revoked_at = now()
      where board_id = v_board.board_id and revoked_at is null;
    elsif v_was_owner then
      perform public.promote_longest_member(v_board.board_id);
    end if;
  end loop;

  update public.profiles
  set avatar_path = null, updated_at = now()
  where id = p_id;

  return true;
end;
$$;

revoke all on function public.cleanup_anonymous_user(uuid) from public, anon, authenticated;
grant execute on function public.cleanup_anonymous_user(uuid) to service_role;
