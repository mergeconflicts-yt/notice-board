-- Restore hand-placed notes: re-add a manual board position.
--
-- docs/plan.md §9 removed drag persistence and computed positions from item
-- ids alone; this migration brings a persisted `layout` back at the owner's
-- request (the plan is superseded here, see docs/backend-plan-questions.md).
--
-- `layout` is null for auto-placed items, otherwise
-- `{x, y, manual: true}` — x is a fraction of board width, y is in the
-- layout's reference points (same convention the client computes with).
alter table public.items
  add column if not exists layout jsonb;

alter table public.items
  add constraint items_layout_shape_check
  check (layout is null or jsonb_typeof(layout) = 'object');

-- Move an item by hand (any member). Passing NULL x/y clears it back to the
-- automatic layout.
create function public.set_item_position(p_id uuid, p_x double precision, p_y double precision)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_row public.items%rowtype;
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
    raise exception 'not_found';
  end if;
  -- Reject NaN / Infinity (Postgres orders NaN as equal to itself and above
  -- all numbers, so GREATEST/LEAST would happily keep it).
  if p_x is not null and (
    p_x = 'NaN'::double precision
    or p_x = 'Infinity'::double precision
    or p_x = '-Infinity'::double precision
  ) then
    raise exception 'invalid_input';
  end if;
  if p_y is not null and (
    p_y = 'NaN'::double precision
    or p_y = 'Infinity'::double precision
    or p_y = '-Infinity'::double precision
  ) then
    raise exception 'invalid_input';
  end if;

  -- Position is presentation metadata: bump updated_at but NOT version, so a
  -- member dragging a note never invalidates the author's in-flight edit.
  if p_x is null or p_y is null then
    update public.items
    set layout = null,
        updated_by = auth.uid(),
        updated_at = now()
    where id = p_id;
    return;
  end if;

  update public.items
  set layout = jsonb_build_object(
        'x', greatest(0::double precision, least(1::double precision, p_x)),
        'y', greatest(0::double precision, p_y),
        'manual', true
      ),
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_id;
end;
$$;

revoke all on function public.set_item_position(uuid, double precision, double precision) from public, anon;
grant execute on function public.set_item_position(uuid, double precision, double precision) to authenticated;
