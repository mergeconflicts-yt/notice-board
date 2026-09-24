-- Notice Board backend, phase 1b (docs/plan.md): core RPC functions.
-- Profile, boards, items, list entries. Invites land in the next batch.
--
-- Rules honoured by every function here: SECURITY DEFINER with an empty
-- search_path (every object schema-qualified), auth guard first, membership
-- or role checks before any work, actor fields stamped from auth.uid() and
-- never taken as parameters, stable error codes as the exception message
-- (not_authenticated, not_member, not_owner, not_author, not_found,
-- invalid_input, version_conflict, rate_limited), version + updated_at
-- bumped on every direct item change. Entry operations update the parent
-- list's keep_until silently (no version bump) so background ticks never
-- cause spurious version_conflicts on in-flight text edits.

-- ---------------------------------------------------------------------------
-- Rate-limit helper (no grant: only callable nested inside API functions).
-- Counts attempts in the rate_limits table (docs/plan.md §10). Because
-- invalid invites return NULL/NULL rather than raising (deviation 6), a
-- failed attempt still commits its increment. A call that then raises rolls
-- back only its own increment, so the committed count stays at the cap and
-- further calls keep being limited. The hourly job clears old windows.
-- ---------------------------------------------------------------------------
create function public.hit_rate_limit(p_action text, p_max integer, p_window interval)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_start timestamptz := to_timestamp(
    floor(extract(epoch from now()) / extract(epoch from p_window))
    * extract(epoch from p_window)
  );
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  insert into public.rate_limits as r (user_id, action, window_start, count)
  values (auth.uid(), p_action, v_start, 1)
  on conflict (user_id, action, window_start) do update set count = r.count + 1
  returning r.count into v_count;
  if v_count > p_max then
    raise exception 'rate_limited';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profile
-- ---------------------------------------------------------------------------

create function public.update_profile(p_display_name text, p_avatar_path text default null)
returns public.profiles
language plpgsql
security definer
set search_path = '' as $$
declare
  v_row public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 40 then
    raise exception 'invalid_input';
  end if;
  -- An avatar path must live under the caller's own folder.
  if p_avatar_path is not null and p_avatar_path not like auth.uid()::text || '/%' then
    raise exception 'invalid_input';
  end if;
  update public.profiles
  set display_name = btrim(p_display_name),
      avatar_path = p_avatar_path
  where id = auth.uid()
  returning * into v_row;
  if v_row.id is null then
    raise exception 'not_found';
  end if;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Boards
-- ---------------------------------------------------------------------------

create function public.create_board(
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
  if p_color not in ('sage', 'blue', 'clay', 'cream', 'charcoal') then
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

create function public.rename_board(p_board_id uuid, p_name text, p_color text)
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
  if p_color not in ('sage', 'blue', 'clay', 'cream', 'charcoal') then
    raise exception 'invalid_input';
  end if;
  if exists (select 1 from public.boards where id = p_board_id and deleted_at is not null) then
    raise exception 'invalid_input';
  end if;
  update public.boards
  set name = btrim(p_name),
      color = p_color,
      updated_at = now()
  where id = p_board_id;
end;
$$;

create function public.delete_board(p_board_id uuid)
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
  if not exists (select 1 from public.boards where id = p_board_id) then
    raise exception 'not_found';
  end if;
  if exists (select 1 from public.boards where id = p_board_id and deleted_at is not null) then
    return; -- idempotent
  end if;
  perform 1 from public.boards where id = p_board_id for update;
  select role into v_role
  from public.board_members
  where board_id = p_board_id and user_id = auth.uid();
  if v_role is null then
    raise exception 'not_member';
  end if;
  if v_role is distinct from 'owner' then
    raise exception 'not_owner';
  end if;
  update public.boards
  set deleted_at = now(),
      updated_at = now()
  where id = p_board_id;
  update public.invites
  set revoked_at = now()
  where board_id = p_board_id and revoked_at is null;
end;
$$;

-- Promote the longest-standing member when a board would otherwise be left
-- without an owner. No grant: nested use only.
create function public.promote_longest_member(p_board_id uuid)
returns void
language plpgsql
security definer
set search_path = '' as $$
begin
  if exists (
    select 1 from public.board_members
    where board_id = p_board_id and role = 'owner'
  ) then
    return;
  end if;
  update public.board_members
  set role = 'owner'
  where (board_id, user_id) = (
    select board_id, user_id
    from public.board_members
    where board_id = p_board_id
    order by joined_at, user_id
    limit 1
  );
end;
$$;

create function public.leave_board(p_board_id uuid)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_role public.member_role;
  v_remaining integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.boards where id = p_board_id) then
    raise exception 'not_found';
  end if;
  select role into v_role
  from public.board_members
  where board_id = p_board_id and user_id = auth.uid();
  if v_role is null then
    raise exception 'not_member';
  end if;
  -- Serialise concurrent membership changes on this board.
  perform 1 from public.boards where id = p_board_id for update;
  delete from public.board_members
  where board_id = p_board_id and user_id = auth.uid();
  select count(*) into v_remaining
  from public.board_members
  where board_id = p_board_id;
  if v_remaining = 0 then
    update public.boards
    set deleted_at = now(),
        updated_at = now()
    where id = p_board_id and deleted_at is null;
    update public.invites
    set revoked_at = now()
    where board_id = p_board_id and revoked_at is null;
    return;
  end if;
  if v_role = 'owner' then
    perform public.promote_longest_member(p_board_id);
  end if;
end;
$$;

create function public.remove_member(p_board_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_caller_role public.member_role;
  v_target_role public.member_role;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.boards where id = p_board_id) then
    raise exception 'not_found';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'invalid_input';
  end if;
  select role into v_caller_role
  from public.board_members
  where board_id = p_board_id and user_id = auth.uid();
  if v_caller_role is null then
    raise exception 'not_member';
  end if;
  if v_caller_role is distinct from 'owner' then
    raise exception 'not_owner';
  end if;
  select role into v_target_role
  from public.board_members
  where board_id = p_board_id and user_id = p_user_id;
  if v_target_role is null then
    raise exception 'not_found';
  end if;
  perform 1 from public.boards where id = p_board_id for update;
  delete from public.board_members
  where board_id = p_board_id and user_id = p_user_id;
  -- The caller stays, so the board never empties here; just keep an owner.
  perform public.promote_longest_member(p_board_id);
  -- Revoke the active invite so a removed member can't rejoin with the old link.
  update public.invites
  set revoked_at = now()
  where board_id = p_board_id and revoked_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Items
-- ---------------------------------------------------------------------------

create function public.post_item(
  p_id uuid,
  p_board_id uuid,
  p_type public.item_type,
  p_color public.item_color,
  p_body text,
  p_title text,
  p_event_at timestamptz,
  p_place text,
  p_photo_path text,
  p_pinned boolean default false,
  p_entries jsonb default null
)
returns public.items
language plpgsql
security definer
set search_path = '' as $$
declare
  v_item public.items%rowtype;
  v_tz text;
  v_new_id uuid;
  v_e record;
  v_eid text;
  v_etext text;
  v_pos integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_member(p_board_id) then
    raise exception 'not_member';
  end if;
  select timezone into v_tz from public.boards where id = p_board_id;
  if p_type = 'date' and p_event_at is null then
    raise exception 'invalid_input';
  end if;
  -- A photo_path belongs to a photo only, and must live under this item's
  -- folder. Otherwise a note could carry another board's path and the purge
  -- job would delete that board's file.
  if p_photo_path is not null then
    if p_type <> 'photo' then
      raise exception 'invalid_input';
    end if;
    if p_photo_path not like p_board_id::text || '/' || p_id::text || '/%' then
      raise exception 'invalid_input';
    end if;
  end if;
  if p_type = 'photo' and p_photo_path is null then
    raise exception 'invalid_input';
  end if;
  if p_type = 'note'
     and (p_body is null or char_length(btrim(p_body)) = 0) then
    raise exception 'invalid_input';
  end if;
  if p_entries is not null then
    if jsonb_typeof(p_entries) != 'array' or p_type != 'list' then
      raise exception 'invalid_input';
    end if;
    if jsonb_array_length(p_entries) > 500 then
      raise exception 'invalid_input';
    end if;
  end if;
  perform public.hit_rate_limit('post_item', 300, interval '1 hour');
  insert into public.items (
    id, board_id, type, color, body, title, event_at, place, photo_path,
    pinned, keep_until, created_by, updated_by
  )
  values (
    p_id, p_board_id, p_type, p_color, p_body, p_title, p_event_at, p_place,
    p_photo_path,
    coalesce(p_pinned, false),
    public.default_keep_until(p_type, p_event_at, coalesce(p_pinned, false), now(), v_tz),
    auth.uid(), auth.uid()
  )
  on conflict (id) do nothing
  returning id into v_new_id;
  -- Only insert entries when THIS call created the item. A re-post with an
  -- existing id (e.g. someone else's item, or a retry) must never attach
  -- entries to it.
  if p_entries is not null and v_new_id is not null then
    for v_e in select value from jsonb_array_elements(p_entries) loop
      if jsonb_typeof(v_e.value) != 'object' then
        raise exception 'invalid_input';
      end if;
      v_eid := v_e.value ->> 'id';
      v_etext := v_e.value ->> 'text';
      if v_eid !~ '^[0-9a-fA-F-]{36}$' then
        raise exception 'invalid_input';
      end if;
      if v_etext is null or char_length(btrim(v_etext)) not between 1 and 200 then
        raise exception 'invalid_input';
      end if;
      insert into public.list_entries (id, item_id, board_id, text, position, created_by)
      values (v_eid::uuid, p_id, p_board_id, btrim(v_etext), v_pos, auth.uid())
      on conflict (id) do nothing;
      v_pos := v_pos + 1;
    end loop;
  end if;
  select * into v_item
  from public.items
  where id = p_id and board_id = p_board_id;
  if v_item.id is null then
    -- The id is taken by another board's row: retries must reuse their own id.
    raise exception 'invalid_input';
  end if;
  return v_item;
end;
$$;

create function public.edit_item(
  p_id uuid,
  p_expected_version integer,
  p_body text,
  p_title text,
  p_event_at timestamptz,
  p_place text,
  p_color public.item_color
)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_row public.items%rowtype;
  v_tz text;
  v_keep timestamptz;
  v_rows integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  -- Lock the row first so a concurrent edit cannot slip between the check and
  -- the write; the version is also re-checked in the UPDATE's WHERE below.
  select * into v_row from public.items where id = p_id for update;
  if v_row.id is null then
    raise exception 'not_found';
  end if;
  if not public.is_member(v_row.board_id) then
    raise exception 'not_member';
  end if;
  if v_row.created_by is distinct from auth.uid() then
    raise exception 'not_author';
  end if;
  if v_row.deleted_at is not null then
    raise exception 'not_found';
  end if;
  if v_row.version != p_expected_version then
    raise exception 'version_conflict';
  end if;
  if v_row.type = 'date' and p_event_at is null then
    raise exception 'invalid_input';
  end if;
  if v_row.type = 'note'
     and (p_body is null or char_length(btrim(p_body)) = 0) then
    raise exception 'invalid_input';
  end if;
  select timezone into v_tz from public.boards where id = v_row.board_id;
  -- Only dates recompute their expiry (day after the event). Everything else
  -- keeps its current keep_until, so editing a note doesn't undo "keep
  -- longer", editing a ticked list doesn't stop it expiring, and a pinned/
  -- done item keeps its own rule.
  v_keep := v_row.keep_until;
  if v_row.type = 'date' then
    -- Pinned wins over done (a pinned item never expires).
    if v_row.pinned then
      v_keep := null;
    elsif v_row.done_at is not null then
      v_keep := v_row.done_at + interval '2 days';
    else
      v_keep := public.default_keep_until(
        'date', coalesce(p_event_at, v_row.event_at), false, now(), v_tz
      );
    end if;
  end if;
  update public.items
  set body = p_body,
      title = p_title,
      event_at = p_event_at,
      place = p_place,
      color = p_color,
      keep_until = v_keep,
      updated_by = auth.uid(),
      updated_at = now(),
      version = v_row.version + 1
  where id = p_id and version = p_expected_version;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'version_conflict';
  end if;
end;
$$;

create function public.set_pinned(p_id uuid, p_pinned boolean)
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
  update public.items
  set pinned = p_pinned,
      keep_until = case
        when p_pinned then null
        -- Unpinning a done item keeps its done-based 2-day window.
        when v_row.done_at is not null then v_row.done_at + interval '2 days'
        when v_row.type = 'list' then null
        else public.default_keep_until(
          v_row.type, v_row.event_at, false, now(),
          (select timezone from public.boards where id = v_row.board_id)
        )
      end,
      updated_by = auth.uid(),
      updated_at = now(),
      version = v_row.version + 1
  where id = p_id and version = v_row.version;
  -- A freshly-unpinned list derives its lifetime from its tick state.
  if v_row.type = 'list' and not p_pinned then
    perform public.run_list_lifetime(p_id);
  end if;
end;
$$;

create function public.set_done(p_id uuid, p_done boolean)
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
  if v_row.type not in ('note', 'date') then
    raise exception 'invalid_input';
  end if;
  if p_done then
    update public.items
    set done_at = now(),
        done_by = auth.uid(),
        -- A pinned item stays forever, even when marked done.
        keep_until = case when v_row.pinned then null else now() + interval '2 days' end,
        updated_by = auth.uid(),
        updated_at = now(),
        version = v_row.version + 1
    where id = p_id and version = v_row.version;
  else
    update public.items
    set done_at = null,
        done_by = null,
        keep_until = public.default_keep_until(
          v_row.type, v_row.event_at, v_row.pinned, now(),
          (select timezone from public.boards where id = v_row.board_id)
        ),
        updated_by = auth.uid(),
        updated_at = now(),
        version = v_row.version + 1
    where id = p_id and version = v_row.version;
  end if;
end;
$$;

create function public.keep_longer(p_id uuid)
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
  if v_row.pinned or v_row.type = 'list' then
    raise exception 'invalid_input';
  end if;
  update public.items
  set keep_until = greatest(v_row.keep_until, now()) + interval '7 days',
      updated_by = auth.uid(),
      updated_at = now(),
      version = v_row.version + 1
  where id = p_id and version = v_row.version;
end;
$$;

create function public.remove_item(p_id uuid)
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
    return; -- idempotent
  end if;
  update public.items
  set deleted_at = now(),
      deleted_by = auth.uid(),
      updated_by = auth.uid(),
      updated_at = now(),
      version = v_row.version + 1
  where id = p_id and version = v_row.version;
end;
$$;

create function public.restore_item(p_id uuid)
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
  if v_row.deleted_at is null then
    return; -- nothing to restore
  end if;
  if v_row.deleted_at < now() - interval '30 days' then
    raise exception 'invalid_input';
  end if;
  update public.items
  set deleted_at = null,
      deleted_by = null,
      keep_until = case
        when v_row.keep_until is not null and v_row.keep_until < now()
        then now() + interval '2 days'
        else v_row.keep_until
      end,
      updated_by = auth.uid(),
      updated_at = now(),
      version = v_row.version + 1
  where id = p_id and version = v_row.version;
end;
$$;

create function public.list_removed_items(p_board_id uuid)
returns setof public.items
language plpgsql
security definer
set search_path = '' as $$
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
  return query
  select *
  from public.items
  where board_id = p_board_id
    and deleted_at is not null
    and deleted_at > now() - interval '30 days'
  order by deleted_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- List entries
-- ---------------------------------------------------------------------------

-- Recomputes a list's keep_until from its tick state. Silent metadata:
-- no version bump, so background ticks never conflict with text edits.
-- No grant: nested use only.
create function public.run_list_lifetime(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_deleted timestamptz;
  v_pinned boolean;
  v_all_checked boolean;
begin
  select deleted_at, pinned into v_deleted, v_pinned
  from public.items where id = p_item_id;
  if v_deleted is not null then
    return;
  end if;
  -- A pinned list stays forever, whatever its tick state.
  if v_pinned then
    update public.items set keep_until = null where id = p_item_id;
    return;
  end if;
  select
      (select count(*) from public.list_entries where item_id = p_item_id) > 0
      and not exists (
        select 1 from public.list_entries
        where item_id = p_item_id and checked_at is null
      )
    into v_all_checked;
  if v_all_checked then
    update public.items
    set keep_until = now() + interval '2 days'
    where id = p_item_id;
  else
    update public.items
    set keep_until = null
    where id = p_item_id;
  end if;
end;
$$;

create function public.add_entry(p_id uuid, p_item_id uuid, p_text text)
returns public.list_entries
language plpgsql
security definer
set search_path = '' as $$
declare
  v_item public.items%rowtype;
  v_entry public.list_entries%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_item from public.items where id = p_item_id for update;
  if v_item.id is null then
    raise exception 'not_found';
  end if;
  if not public.is_member(v_item.board_id) then
    raise exception 'not_member';
  end if;
  if v_item.deleted_at is not null then
    raise exception 'not_found';
  end if;
  if v_item.type != 'list' then
    raise exception 'invalid_input';
  end if;
  if p_text is null or char_length(btrim(p_text)) not between 1 and 200 then
    raise exception 'invalid_input';
  end if;
  perform public.hit_rate_limit('add_entry', 300, interval '1 hour');
  if (select count(*) from public.list_entries where item_id = p_item_id) >= 500 then
    raise exception 'invalid_input';
  end if;
  insert into public.list_entries (id, item_id, board_id, text, position, created_by)
  values (
    p_id, p_item_id, v_item.board_id, btrim(p_text),
    (select coalesce(max(position), -1) + 1
     from public.list_entries
     where item_id = p_item_id),
    auth.uid()
  )
  on conflict (id) do nothing;
  -- A new (unchecked) entry means a fully-ticked list is no longer done, so
  -- its lifetime must be recomputed (back to "stays").
  perform public.run_list_lifetime(p_item_id);
  select * into v_entry
  from public.list_entries
  where id = p_id and item_id = p_item_id;
  if v_entry.id is null then
    raise exception 'invalid_input';
  end if;
  return v_entry;
end;
$$;

create function public.set_entry_checked(p_id uuid, p_checked boolean)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_entry public.list_entries%rowtype;
  v_parent public.items%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_entry from public.list_entries where id = p_id;
  if v_entry.id is null then
    raise exception 'not_found';
  end if;
  if not public.is_member(v_entry.board_id) then
    raise exception 'not_member';
  end if;
  -- Lock the parent list first, so two people ticking the last two entries
  -- can't both recompute keep_until from a stale read (which could leave the
  -- list alive forever, or expire it early).
  select * into v_parent from public.items where id = v_entry.item_id for update;
  if v_parent.id is null or v_parent.deleted_at is not null then
    raise exception 'not_found';
  end if;
  select * into v_entry from public.list_entries where id = p_id for update;
  if p_checked then
    -- First tick wins: an already-checked entry keeps its original checker.
    if v_entry.checked_at is null then
      update public.list_entries
      set checked_at = now(),
          checked_by = auth.uid(),
          updated_at = now()
      where id = p_id;
    end if;
  else
    update public.list_entries
    set checked_at = null,
        checked_by = null,
        updated_at = now()
    where id = p_id;
  end if;
  perform public.run_list_lifetime(v_entry.item_id);
end;
$$;

create function public.edit_entry(p_id uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_entry public.list_entries%rowtype;
  v_parent public.items%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_entry from public.list_entries where id = p_id;
  if v_entry.id is null then
    raise exception 'not_found';
  end if;
  if not public.is_member(v_entry.board_id) then
    raise exception 'not_member';
  end if;
  select * into v_parent from public.items where id = v_entry.item_id for update;
  if v_parent.id is null or v_parent.deleted_at is not null then
    raise exception 'not_found';
  end if;
  if p_text is null or char_length(btrim(p_text)) not between 1 and 200 then
    raise exception 'invalid_input';
  end if;
  update public.list_entries
  set text = btrim(p_text),
      updated_at = now()
  where id = p_id;
end;
$$;

create function public.remove_entry(p_id uuid)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_entry public.list_entries%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_entry from public.list_entries where id = p_id;
  if v_entry.id is null then
    raise exception 'not_found';
  end if;
  if not public.is_member(v_entry.board_id) then
    raise exception 'not_member';
  end if;
  -- Serialise with ticks so the list lifetime is recomputed on fresh state.
  perform 1 from public.items where id = v_entry.item_id for update;
  select * into v_entry from public.list_entries where id = p_id for update;
  delete from public.list_entries where id = p_id;
  perform public.run_list_lifetime(v_entry.item_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: every API function above, authenticated only.
-- Helpers (hit_rate_limit, promote_longest_member, run_list_lifetime) stay
-- ungranted: nested use only.
-- ---------------------------------------------------------------------------

revoke all on function public.update_profile(text, text) from public, anon;
grant execute on function public.update_profile(text, text) to authenticated;

revoke all on function public.create_board(text, text, text) from public, anon;
grant execute on function public.create_board(text, text, text) to authenticated;

revoke all on function public.rename_board(uuid, text, text) from public, anon;
grant execute on function public.rename_board(uuid, text, text) to authenticated;

revoke all on function public.delete_board(uuid) from public, anon;
grant execute on function public.delete_board(uuid) to authenticated;

revoke all on function public.leave_board(uuid) from public, anon;
grant execute on function public.leave_board(uuid) to authenticated;

revoke all on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

revoke all on function public.post_item(uuid, uuid, item_type, item_color, text, text, timestamptz, text, text, boolean, jsonb) from public, anon;
grant execute on function public.post_item(uuid, uuid, item_type, item_color, text, text, timestamptz, text, text, boolean, jsonb) to authenticated;

revoke all on function public.edit_item(uuid, integer, text, text, timestamptz, text, item_color) from public, anon;
grant execute on function public.edit_item(uuid, integer, text, text, timestamptz, text, item_color) to authenticated;

revoke all on function public.set_pinned(uuid, boolean) from public, anon;
grant execute on function public.set_pinned(uuid, boolean) to authenticated;

revoke all on function public.set_done(uuid, boolean) from public, anon;
grant execute on function public.set_done(uuid, boolean) to authenticated;

revoke all on function public.keep_longer(uuid) from public, anon;
grant execute on function public.keep_longer(uuid) to authenticated;

revoke all on function public.remove_item(uuid) from public, anon;
grant execute on function public.remove_item(uuid) to authenticated;

revoke all on function public.restore_item(uuid) from public, anon;
grant execute on function public.restore_item(uuid) to authenticated;

revoke all on function public.list_removed_items(uuid) from public, anon;
grant execute on function public.list_removed_items(uuid) to authenticated;

revoke all on function public.add_entry(uuid, uuid, text) from public, anon;
grant execute on function public.add_entry(uuid, uuid, text) to authenticated;

revoke all on function public.set_entry_checked(uuid, boolean) from public, anon;
grant execute on function public.set_entry_checked(uuid, boolean) to authenticated;

revoke all on function public.edit_entry(uuid, text) from public, anon;
grant execute on function public.edit_entry(uuid, text) to authenticated;

revoke all on function public.remove_entry(uuid) from public, anon;
grant execute on function public.remove_entry(uuid) to authenticated;
