-- Phase 5 (docs/plan.md §5): account deletion.
--
-- delete_account() only tidies board state for the caller's departure; the
-- auth user itself is removed by the delete-account Edge Function (Postgres
-- cannot safely delete auth.users). Posts survive because items.created_by
-- references profiles(id) ON DELETE SET NULL, so deleting the user nulls the
-- author and the board shows "Former member".
--
-- Behaviour:
--   * boards where the caller is the only member -> soft-deleted, invite revoked;
--   * boards with others where the caller is the last owner -> promote the
--     longest-standing member;
--   * caller's memberships removed, avatar cleared.
create function public.delete_account()
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_board record;
  v_board_id uuid;
  v_was_owner boolean;
  v_remaining integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Lock the caller's boards FIRST, in id order, THEN the membership rows.
  -- leave_board takes locks in the same order (board, then member row), so a
  -- concurrent leave/delete can't deadlock. (Selecting membership rows FOR
  -- UPDATE first — as this used to — inverts the order.)
  for v_board_id in
    select b.id
    from public.boards b
    join public.board_members m on m.board_id = b.id
    where m.user_id = v_uid
    order by b.id
  loop
    perform 1 from public.boards where id = v_board_id for update;
  end loop;

  for v_board in
    select board_id, role
    from public.board_members
    where user_id = v_uid
    order by board_id
  loop
    v_was_owner := v_board.role = 'owner';
    delete from public.board_members
    where board_id = v_board.board_id and user_id = v_uid;
    select count(*) into v_remaining
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
  where id = v_uid;
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
