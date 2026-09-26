-- Vintage fridge colors: mint, butter, blush, powder join the palette.
-- The app (src/types, src/theme) already offers all nine; the DB still only
-- allowed the original five, so picking a new color failed on the table CHECK.
-- Widen the CHECK plus create_board/rename_board validation to match.

do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.boards'::regclass
      and contype = 'c'
      and conname in ('boards_color_check', 'boards_color_check_v2')
  loop
    execute format('alter table public.boards drop constraint %I', r.conname);
  end loop;
end;
$$;

alter table public.boards
  add constraint boards_color_check_v2
  check (color in ('sage', 'blue', 'clay', 'cream', 'charcoal', 'mint', 'butter', 'blush', 'powder'));

create or replace function public.create_board(
  p_name text,
  p_color text default 'sage',
  p_timezone text default 'UTC'
)
returns public.boards
language plpgsql
security definer
set search_path = '' as $$
declare
  v_board public.boards%rowtype;
  v_tz text := coalesce(nullif(btrim(p_timezone), ''), 'UTC');
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then
    raise exception 'invalid_input';
  end if;
  if p_color is null or p_color not in ('sage', 'blue', 'clay', 'cream', 'charcoal', 'mint', 'butter', 'blush', 'powder') then
    raise exception 'invalid_input';
  end if;
  -- Reject an unknown zone so date expiry can't silently fall back to UTC.
  if not exists (select 1 from pg_timezone_names where name = v_tz) then
    raise exception 'invalid_input';
  end if;
  perform public.hit_rate_limit('create_board', 10, interval '1 hour');
  insert into public.boards (name, color, timezone, created_by)
  values (btrim(p_name), p_color, v_tz, auth.uid())
  returning * into v_board;
  insert into public.board_members (board_id, user_id, role)
  values (v_board.id, auth.uid(), 'owner');
  return v_board;
end;
$$;

create or replace function public.rename_board(p_board_id uuid, p_name text, p_color text)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_role public.member_role;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_member(p_board_id) then
    if not exists (select 1 from public.boards where id = p_board_id) then
      raise exception 'not_found';
    end if;
    raise exception 'not_member';
  end if;
  select role into v_role
  from public.board_members
  where board_id = p_board_id and user_id = auth.uid();
  if v_role is distinct from 'owner' then
    raise exception 'not_owner';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then
    raise exception 'invalid_input';
  end if;
  if p_color is null or p_color not in ('sage', 'blue', 'clay', 'cream', 'charcoal', 'mint', 'butter', 'blush', 'powder') then
    raise exception 'invalid_input';
  end if;
  if exists (select 1 from public.boards where id = p_board_id and deleted_at is not null) then
    raise exception 'invalid_input';
  end if;
  perform public.hit_rate_limit('item_write', 600, interval '1 hour');
  update public.boards
  set name = btrim(p_name),
      color = p_color,
      updated_at = now()
  where id = p_board_id;
end;
$$;
