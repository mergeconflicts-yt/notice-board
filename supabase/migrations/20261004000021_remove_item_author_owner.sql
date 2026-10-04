-- Only the author or a board owner may remove a post (was: any member).
-- Replaces public.remove_item(uuid) from 20260925000001_functions_core.sql;
-- grants are re-issued explicitly per repo convention (OR REPLACE preserves
-- them, this just states intent). Error code follows the magnets precedent:
-- 'not_allowed' ("Only the person who put it there can take it off.").
-- Posts whose author is gone (created_by NULL) are owner-only.
create or replace function public.remove_item(p_id uuid)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_row public.items%rowtype;
  v_caller_role public.member_role;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_row from public.items where id = p_id for update;
  if v_row.id is null then
    raise exception 'not_found';
  end if;
  if not public.is_member(v_row.board_id) then
    raise exception 'not_member';
  end if;
  if v_row.deleted_at is not null then
    return; -- idempotent
  end if;
  if v_row.created_by is distinct from auth.uid() then
    select role into v_caller_role
    from public.board_members
    where board_id = v_row.board_id and user_id = auth.uid();
    if v_caller_role is distinct from 'owner' then
      raise exception 'not_allowed';
    end if;
  end if;
  perform public.hit_rate_limit('item_write', 600, interval '1 hour');
  update public.items
  set deleted_at = now(),
      deleted_by = auth.uid(),
      updated_by = auth.uid(),
      updated_at = now(),
      version = v_row.version + 1
  where id = p_id and version = v_row.version;
end;
$$;

revoke all on function public.remove_item(uuid) from public, anon;
grant execute on function public.remove_item(uuid) to authenticated;
