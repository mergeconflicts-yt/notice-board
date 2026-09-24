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
-- Counts attempts with a per-user/action/window SEQUENCE, not the
-- rate_limits table: sequence increments survive transaction rollback, so
-- failed attempts (wrong invite codes, rejected writes) count toward the
-- limit exactly like successes. A table row would roll back together with
-- the failed call it was meant to throttle. Stale sequences are dropped by
-- the hourly cleanup job (phase 6); the rate_limits table stays defined
-- for future audit use.
-- ---------------------------------------------------------------------------

create function public.hit_rate_limit(p_action text, p_max integer, p_window interval)
returns void
language plpgsql
security definer
set search_path = ''
set client_min_messages = warning as $$
declare
  v_epoch bigint := (
    floor(extract(epoch from now()) / extract(epoch from p_window))
    * extract(epoch from p_window)
  )::bigint;
  v_seq text := 'rl_'
    || regexp_replace(auth.uid()::text, '[^a-z0-9]', '', 'g') || '_'
    || regexp_replace(p_action, '[^a-z0-9_]', '_', 'g') || '_'
    || v_epoch::text;
  v_n bigint;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  execute format('create sequence if not exists public.%I', v_seq);
  execute format('select nextval(%L)', 'public.' || v_seq) into v_n;
  if v_n > p_max then
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

create function public.create_board(p_name text, p_color text default 'sage')
returns public.boards
language plpgsql
security definer
set search_path = '' as $$
declare
  v_board public.boards%rowtype;
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
  perform public.hit_rate_limit('create_board', 10, interval '1 hour');
  insert into public.boards (name, color, created_by)
  values (btrim(p_name), p_color, auth.uid())
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
  if p_type = 'date' and p_event_at is null then
    raise exception 'invalid_input';
  end if;
  if p_type = 'photo' then
    if p_photo_path is null then
      raise exception 'invalid_input';
    end if;
    if p_photo_path not like p_board_id::text || '/' || p_id::text || '/%' then
      raise exception 'invalid_input';
    end if;
  end if;
  if p_type = 'note'
     and (p_body is null or char_length(btrim(p_body)) = 0) then
    raise exception 'invalid_input';
  end if;
  if p_entries is not null then
    if jsonb_typeof(p_entries) != 'array' or p_type != 'list' then
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
    public.default_keep_until(p_type, p_event_at, coalesce(p_pinned, false), now()),
    auth.uid(), auth.uid()
  )
  on conflict (id) do nothing;
  if p_entries is not null then
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
  v_keep timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_row from public.items where id = p_id;
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
  if v_row.done_at is not null then
    v_keep := v_row.done_at + interval '2 days';
  else
    v_keep := public.default_keep_until(
      v_row.type, coalesce(p_event_at, v_row.event_at), v_row.pinned, now()
    );
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
  where id = p_id;
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
        else public.default_keep_until(v_row.type, v_row.event_at, false, now())
      end,
      updated_by = auth.uid(),
      updated_at = now(),
      version = v_row.version + 1
  where id = p_id;
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
        keep_until = now() + interval '2 days',
        updated_by = auth.uid(),
        updated_at = now(),
        version = v_row.version + 1
    where id = p_id;
  else
    update public.items
    set done_at = null,
        done_by = null,
        keep_until = public.default_keep_until(v_row.type, v_row.event_at, v_row.pinned, now()),
        updated_by = auth.uid(),
        updated_at = now(),
        version = v_row.version + 1
    where id = p_id;
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
  where id = p_id;
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
  select * into v_row from public.items where id = p_id;
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
  where id = p_id;
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
  select * into v_row from public.items where id = p_id;
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
  where id = p_id;
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
  v_all_checked boolean;
begin
  select deleted_at into v_deleted from public.items where id = p_item_id;
  if v_deleted is not null then
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
  insert into public.list_entries (id, item_id, board_id, text, position, created_by)
  values (
    p_id, p_item_id, v_item.board_id, btrim(p_text),
    (select coalesce(max(position), -1) + 1
     from public.list_entries
     where item_id = p_item_id),
    auth.uid()
  )
  on conflict (id) do nothing;
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
  v_parent_deleted timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_entry from public.list_entries where id = p_id for update;
  if v_entry.id is null then
    raise exception 'not_found';
  end if;
  if not public.is_member(v_entry.board_id) then
    raise exception 'not_member';
  end if;
  select deleted_at into v_parent_deleted
  from public.items
  where id = v_entry.item_id;
  if v_parent_deleted is not null then
    raise exception 'not_found';
  end if;
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
  v_parent_deleted timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_entry from public.list_entries where id = p_id for update;
  if v_entry.id is null then
    raise exception 'not_found';
  end if;
  if not public.is_member(v_entry.board_id) then
    raise exception 'not_member';
  end if;
  select deleted_at into v_parent_deleted
  from public.items
  where id = v_entry.item_id;
  if v_parent_deleted is not null then
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
  select * into v_entry from public.list_entries where id = p_id for update;
  if v_entry.id is null then
    raise exception 'not_found';
  end if;
  if not public.is_member(v_entry.board_id) then
    raise exception 'not_member';
  end if;
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

revoke all on function public.create_board(text, text) from public, anon;
grant execute on function public.create_board(text, text) to authenticated;

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
