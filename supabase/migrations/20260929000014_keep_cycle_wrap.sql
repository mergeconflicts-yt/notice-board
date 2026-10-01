-- keep_cycle wrap trigger: wrap when a full +7d step no longer fits under
-- the now()+30d cap (not only once already past it — wall-clock drift means
-- a capped date always sits a few ms under the moving cap, so the
-- past-the-cap test never fired and Keep dead-ended). ADD-ONLY (freeze in
-- effect since the 2026-09-28 first push): replaces the logic from
-- 20260929000013_keep_cycle.sql, which is superseded but left in history.

create or replace function public.keep_cycle(p_id uuid)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_row public.items%rowtype;
  v_tz text;
  v_base timestamptz;
  v_next timestamptz;
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
  if v_row.pinned or v_row.type = 'list' then
    raise exception 'invalid_input';
  end if;
  select timezone into v_tz from public.boards where id = v_row.board_id;
  -- Never shorten a live date: extend from the later of keep_until and now.
  v_base := greatest(coalesce(v_row.keep_until, now()), now());
  if v_base + interval '7 days' > now() + interval '30 days' then
    -- A full +7d step no longer fits under the cap: wrap back to the
    -- type's standard lifetime from now so Keep repeats the same cycle.
    v_next := public.default_keep_until(
      v_row.type, v_row.event_at, false, now(), coalesce(v_tz, 'UTC')
    );
    -- A far-future date's default still lies beyond the cap: keep the
    -- current date rather than shortening it.
    if v_next is null or v_next <= v_row.keep_until then
      v_next := v_row.keep_until;
    end if;
  else
    v_next := v_base + interval '7 days';
  end if;
  perform public.hit_rate_limit('item_write', 600, interval '1 hour');
  update public.items
  set keep_until = v_next,
      updated_by = auth.uid(),
      updated_at = now(),
      version = v_row.version + 1
  where id = p_id and version = v_row.version;
end;
$$;

revoke all on function public.keep_cycle(uuid) from public, anon;
grant execute on function public.keep_cycle(uuid) to authenticated;
