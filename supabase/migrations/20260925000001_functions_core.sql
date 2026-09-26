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

create function public.update_profile(
  p_display_name text,
  p_avatar_path text default null,
  p_clear_avatar boolean default false
)
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
  -- An avatar path must live under the caller's own folder and be well formed.
  if p_avatar_path is not null then
    if p_clear_avatar then
      raise exception 'invalid_input';
    end if;
    if char_length(p_avatar_path) > 200
       or p_avatar_path !~ ('^' || auth.uid()::text || '/[^/]+$') then
      raise exception 'invalid_input';
    end if;
  end if;
  -- p_avatar_path null means "keep the current avatar"; only p_clear_avatar
  -- removes it. This stops a plain rename from wiping the avatar.
  perform public.hit_rate_limit('item_write', 600, interval '1 hour');
  update public.profiles
  set display_name = btrim(p_display_name),
      avatar_path = case
        when p_clear_avatar then null
        else coalesce(p_avatar_path, avatar_path)
      end
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
  if p_color is null or p_color not in ('sage', 'blue', 'clay', 'cream', 'charcoal') then
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
  if p_color is null or p_color not in ('sage', 'blue', 'clay', 'cream', 'charcoal') then
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
  -- Lock first, then require ownership via raw membership (which survives the
  -- soft delete). Missing/non-member both return not_member, so the error
  -- never reveals that a board exists; a repeat delete by the owner is still
  -- idempotent.
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
  if exists (select 1 from public.boards where id = p_board_id and deleted_at is not null) then
    return; -- idempotent
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

-- ---------------------------------------------------------------------------
-- Photo upload intents: every photo upload is bound to a server-issued path.
-- The board-photos storage policy only accepts the exact live intent path,
-- and post_item consumes the intent when the photo is linked — so bytes
-- uploaded outside the intent flow can never appear on a board. Quotas bound
-- the abuse: 300 intents/hour, 20 pending per user (orphan bytes), 500 live
-- photos per board. Client-side resize/re-encode (EXIF strip) still happens
-- on device; byte-level server-side validation needs an Edge Function on the
-- storage webhook.
-- ---------------------------------------------------------------------------

create function public.start_photo_upload(p_board_id uuid, p_item_id uuid)
returns text
language plpgsql
security definer
set search_path = '' as $$
declare
  v_path text;
  v_pending integer;
  v_live_photos integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_board_id is null or p_item_id is null then
    raise exception 'invalid_input';
  end if;
  if not public.is_member(p_board_id) then
    raise exception 'not_member';
  end if;
  perform public.hit_rate_limit('photo_upload', 300, interval '1 hour');
  select count(*)::integer into v_pending
  from public.photo_upload_intents
  where user_id = auth.uid() and consumed = false and expires_at > now();
  if v_pending >= 20 then
    raise exception 'rate_limited';
  end if;
  select count(*)::integer into v_live_photos
  from public.items
  where board_id = p_board_id and photo_path is not null and deleted_at is null;
  if v_live_photos >= 500 then
    raise exception 'rate_limited';
  end if;
  v_path := p_board_id::text || '/' || p_item_id::text || '/'
    || extensions.gen_random_uuid()::text || '.jpg';
  insert into public.photo_upload_intents (path, board_id, item_id, user_id)
  values (v_path, p_board_id, p_item_id, auth.uid());
  return v_path;
end;
$$;

-- Consume helper for post_item (nested use only, no grant): the path must
-- resolve to an intent issued to this caller for this exact item — live, or
-- already consumed by an idempotent retry of the same item id. A forged path,
-- an expired unused intent, another user's path, or a replay onto another
-- item (the path embeds the item id, checked by post_item first) all fail.
create function public._consume_photo_intent(
  p_board_id uuid, p_item_id uuid, p_photo_path text
)
returns void
language plpgsql
security definer
set search_path = '' as $$
begin
  update public.photo_upload_intents
  set consumed = true
  where path = p_photo_path
    and board_id = p_board_id
    and item_id = p_item_id
    and user_id = auth.uid()
    and (consumed or expires_at > now());
  if not found then
    raise exception 'invalid_input';
  end if;
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
  -- Lock first, then require a live board and live membership. A missing,
  -- deleted or foreign board all yield not_member, so the error never reveals
  -- that a board exists; the lock serialises concurrent leaves/promotions and
  -- keeps the role read below from going stale.
  perform 1 from public.boards where id = p_board_id for update;
  if not exists (select 1 from public.boards where id = p_board_id and deleted_at is null) then
    raise exception 'not_member';
  end if;
  select role into v_role
  from public.board_members
  where board_id = p_board_id and user_id = auth.uid();
  if v_role is null then
    raise exception 'not_member';
  end if;
  delete from public.board_members
  where board_id = p_board_id and user_id = auth.uid();
  select count(*)::integer into v_remaining
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
  -- Unconditional: promotes the longest-standing member when the board would
  -- otherwise be ownerless, and is a no-op when another owner remains.
  perform public.promote_longest_member(p_board_id);
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
  v_remaining integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'invalid_input';
  end if;
  -- Lock the board before reading either role. A missing/deleted/foreign board
  -- all return not_member, so the error never reveals that a board exists.
  perform 1 from public.boards where id = p_board_id for update;
  if not exists (select 1 from public.boards where id = p_board_id and deleted_at is null) then
    raise exception 'not_member';
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
  perform public.hit_rate_limit('item_write', 600, interval '1 hour');
  delete from public.board_members
  where board_id = p_board_id and user_id = p_user_id;
  select count(*)::integer into v_remaining
  from public.board_members
  where board_id = p_board_id;
  -- The caller normally stays, but if a concurrent removal emptied the board,
  -- soft-delete it rather than leave a memberless live board behind.
  if v_remaining = 0 then
    update public.boards
    set deleted_at = now(),
        updated_at = now()
    where id = p_board_id and deleted_at is null;
  else
    -- Keep an owner even if the removed target was the only one.
    perform public.promote_longest_member(p_board_id);
  end if;
  -- Revoke the active invite so a removed member can't rejoin with the old link.
  update public.invites
  set revoked_at = now()
  where board_id = p_board_id and revoked_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Safety: quiet per-post reports (owner-only queue) and member blocking.
-- Boards are private and invite-only, but anyone on a board can post to
-- everyone else on it, so any member can report a post and the board owner
-- can remove/keep it and block members. Blocked users get a silent NULL from
-- accept_invite even with a fresh link.
-- ---------------------------------------------------------------------------

create function public.report_post(p_item_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_board uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_item_id is null then
    raise exception 'invalid_input';
  end if;
  if p_reason is not null and char_length(p_reason) > 500 then
    raise exception 'invalid_input';
  end if;
  select board_id into v_board
  from public.items
  where id = p_item_id and deleted_at is null;
  if v_board is null or not public.is_member(v_board) then
    raise exception 'not_member';
  end if;
  perform public.hit_rate_limit('report_post', 20, interval '1 hour');
  insert into public.post_reports (item_id, board_id, reporter_id, reason)
  values (p_item_id, v_board, auth.uid(),
    case when p_reason is null then null else btrim(p_reason) end)
  on conflict (item_id, reporter_id) do nothing;
end;
$$;

create function public.list_reported_items(p_board_id uuid)
returns table (
  id uuid, board_id uuid, type public.item_type, color public.item_color,
  body text, title text, event_at timestamptz, place text, photo_path text,
  pinned boolean, keep_until timestamptz, created_by uuid, version integer,
  created_at timestamptz, updated_at timestamptz, report_count integer
)
language plpgsql
security definer
set search_path = '' as $$
declare
  v_role public.member_role;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select role into v_role
  from public.board_members
  where board_members.board_id = p_board_id and user_id = auth.uid();
  if v_role is null then
    raise exception 'not_member';
  end if;
  if v_role is distinct from 'owner' then
    raise exception 'not_owner';
  end if;
  return query
  select i.id, i.board_id, i.type, i.color, i.body, i.title, i.event_at,
    i.place, i.photo_path, i.pinned, i.keep_until, i.created_by, i.version,
    i.created_at, i.updated_at, count(r.id)::integer
  from public.items i
  join public.post_reports r on r.item_id = i.id
  where i.board_id = p_board_id and i.deleted_at is null
  group by i.id
  order by max(r.created_at) desc;
end;
$$;

create function public.dismiss_reports(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_board uuid;
  v_role public.member_role;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select board_id into v_board from public.items where id = p_item_id;
  if v_board is null then
    raise exception 'not_found';
  end if;
  select role into v_role
  from public.board_members
  where board_members.board_id = v_board and user_id = auth.uid();
  if v_role is null then
    raise exception 'not_member';
  end if;
  if v_role is distinct from 'owner' then
    raise exception 'not_owner';
  end if;
  perform public.hit_rate_limit('item_write', 600, interval '1 hour');
  delete from public.post_reports where item_id = p_item_id;
end;
$$;

create function public.block_member(p_board_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_caller_role public.member_role;
  v_remaining integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'invalid_input';
  end if;
  -- Same lock-then-check order as remove_member (board -> member rows).
  perform 1 from public.boards where id = p_board_id for update;
  if not exists (select 1 from public.boards where id = p_board_id and deleted_at is null) then
    raise exception 'not_member';
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
  perform public.hit_rate_limit('item_write', 600, interval '1 hour');
  delete from public.board_members
  where board_id = p_board_id and user_id = p_user_id;
  -- The target must be a real account — otherwise the block insert would fail
  -- on the raw foreign key instead of a stable error code.
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'not_found';
  end if;
  insert into public.board_blocks (board_id, user_id, blocked_by)
  values (p_board_id, p_user_id, auth.uid())
  on conflict (board_id, user_id) do nothing;
  select count(*)::integer into v_remaining
  from public.board_members
  where board_id = p_board_id;
  if v_remaining = 0 then
    update public.boards
    set deleted_at = now(), updated_at = now()
    where id = p_board_id and deleted_at is null;
  else
    perform public.promote_longest_member(p_board_id);
  end if;
  -- A blocked member must not rejoin with the current link either.
  update public.invites
  set revoked_at = now()
  where board_id = p_board_id and revoked_at is null;
end;
$$;

create function public.unblock_member(p_board_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_caller_role public.member_role;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  perform 1 from public.boards where id = p_board_id for update;
  if not exists (select 1 from public.boards where id = p_board_id and deleted_at is null) then
    raise exception 'not_member';
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
  perform public.hit_rate_limit('item_write', 600, interval '1 hour');
  delete from public.board_blocks
  where board_id = p_board_id and user_id = p_user_id;
  if not found then
    raise exception 'not_found';
  end if;
  -- Unblocking does not re-add the membership: the person rejoins with a
  -- fresh invite link, like any new member.
end;
$$;

create function public.list_blocked(p_board_id uuid)
returns table (user_id uuid, display_name text, blocked_at timestamptz)
language plpgsql
security definer
set search_path = '' as $$
declare
  v_role public.member_role;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select role into v_role
  from public.board_members
  where board_members.board_id = p_board_id and board_members.user_id = auth.uid();
  if v_role is null then
    raise exception 'not_member';
  end if;
  if v_role is distinct from 'owner' then
    raise exception 'not_owner';
  end if;
  return query
  select b.user_id, p.display_name, b.blocked_at
  from public.board_blocks b
  join public.profiles p on p.id = b.user_id
  where b.board_id = p_board_id
  order by b.blocked_at desc;
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
  -- Reject NULLs explicitly: they would otherwise slip past the comparisons
  -- and fail later as a raw not-null or check-constraint error.
  if p_id is null or p_type is null or p_color is null then
    raise exception 'invalid_input';
  end if;
  select timezone into v_tz from public.boards where id = p_board_id;
  if p_type = 'date' and p_event_at is null then
    raise exception 'invalid_input';
  end if;
  -- event_at is dates only and must be a real instant: 'infinity' would
  -- otherwise mean "never expires". title is list/date, place is date.
  if p_event_at is not null and (p_type <> 'date' or not isfinite(p_event_at)) then
    raise exception 'invalid_input';
  end if;
  if p_title is not null and p_type not in ('list', 'date') then
    raise exception 'invalid_input';
  end if;
  if p_place is not null and p_type <> 'date' then
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
    -- The path must come from a live upload intent issued to this caller for
    -- this exact item (consumes the intent, so a path cannot be linked twice
    -- or replayed onto another item). Retries of the same item id still pass.
    perform public._consume_photo_intent(p_board_id, p_id, p_photo_path);
  end if;
  if p_type = 'photo' and p_photo_path is null then
    raise exception 'invalid_input';
  end if;
  if p_type = 'note'
     and (p_body is null or char_length(btrim(p_body)) = 0) then
    raise exception 'invalid_input';
  end if;
  -- Column check constraints cap raw lengths; catch them as invalid_input.
  if p_body is not null and char_length(p_body) > 2000 then
    raise exception 'invalid_input';
  end if;
  if p_title is not null and char_length(p_title) > 120 then
    raise exception 'invalid_input';
  end if;
  if p_place is not null and char_length(p_place) > 120 then
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
      if v_eid is null
         or v_eid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
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
  -- Same field/type rules as post_item; 'infinity' would never expire.
  if p_event_at is not null and (v_row.type <> 'date' or not isfinite(p_event_at)) then
    raise exception 'invalid_input';
  end if;
  if p_title is not null and v_row.type not in ('list', 'date') then
    raise exception 'invalid_input';
  end if;
  if p_place is not null and v_row.type <> 'date' then
    raise exception 'invalid_input';
  end if;
  if v_row.type = 'note'
     and (p_body is null or char_length(btrim(p_body)) = 0) then
    raise exception 'invalid_input';
  end if;
  if p_color is null then
    raise exception 'invalid_input';
  end if;
  -- Column check constraints cap raw lengths; catch them as invalid_input.
  if p_body is not null and char_length(p_body) > 2000 then
    raise exception 'invalid_input';
  end if;
  if p_title is not null and char_length(p_title) > 120 then
    raise exception 'invalid_input';
  end if;
  if p_place is not null and char_length(p_place) > 120 then
    raise exception 'invalid_input';
  end if;
  select timezone into v_tz from public.boards where id = v_row.board_id;
  -- Only dates recompute their expiry (day after the event). Everything else
  -- keeps its current keep_until, so editing a note doesn't undo "keep
  -- longer", editing a ticked list doesn't stop it expiring, and a pinned/
  -- done item keeps its own rule.
  v_keep := v_row.keep_until;
  -- Recompute a date's expiry only when its event actually changed, so editing
  -- the title of a date the member kept longer doesn't drop that extension.
  -- Floor at now + 2 days (like restore) so a date moved into the past never
  -- vanishes the instant it is saved.
  if v_row.type = 'date' and p_event_at is distinct from v_row.event_at then
    -- Pinned wins over done (a pinned item never expires).
    if v_row.pinned then
      v_keep := null;
    elsif v_row.done_at is not null then
      v_keep := greatest(v_row.done_at + interval '2 days', now() + interval '2 days');
    else
      v_keep := greatest(
        public.default_keep_until('date', p_event_at, false, now(), v_tz),
        now() + interval '2 days'
      );
    end if;
  end if;
  perform public.hit_rate_limit('item_write', 600, interval '1 hour');
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
  if p_pinned is null then
    raise exception 'invalid_input';
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
  -- Idempotent: setting the state it already has is a no-op.
  if v_row.pinned = p_pinned then
    return;
  end if;
  perform public.hit_rate_limit('item_write', 600, interval '1 hour');
  update public.items
  set pinned = p_pinned,
      keep_until = case
        when p_pinned then null
        -- Unpinning a done item keeps its done-based 2-day window, but never
        -- one already in the past — floor it at now + 2 days.
        when v_row.done_at is not null then
          greatest(v_row.done_at + interval '2 days', now() + interval '2 days')
        when v_row.type = 'list' then null
        else greatest(
          public.default_keep_until(
            v_row.type, v_row.event_at, false, now(),
            (select timezone from public.boards where id = v_row.board_id)
          ),
          now() + interval '2 days'
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
  if p_done is null then
    raise exception 'invalid_input';
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
    -- First done wins: re-marking is idempotent so done_at/done_by don't move.
    if v_row.done_at is not null then
      return;
    end if;
    perform public.hit_rate_limit('item_write', 600, interval '1 hour');
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
    -- Already not done: nothing to undo.
    if v_row.done_at is null then
      return;
    end if;
    perform public.hit_rate_limit('item_write', 600, interval '1 hour');
    update public.items
    set done_at = null,
        done_by = null,
        keep_until = case
          when v_row.pinned then null
          -- Floor at now + 2 days so reopening a past date doesn't vanish it.
          else greatest(
            public.default_keep_until(
              v_row.type, v_row.event_at, false, now(),
              (select timezone from public.boards where id = v_row.board_id)
            ),
            now() + interval '2 days'
          )
        end,
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
  perform public.hit_rate_limit('item_write', 600, interval '1 hour');
  update public.items
  set keep_until = greatest(
        v_row.keep_until,
        -- +7 days, never past now + 30 days, and never shortening an item
        -- whose date already lies beyond the cap.
        least(
          greatest(v_row.keep_until, now()) + interval '7 days',
          now() + interval '30 days'
        )
      ),
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
  perform public.hit_rate_limit('item_write', 600, interval '1 hour');
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
    update public.items
    set keep_until = null, updated_at = now()
    where id = p_item_id;
    return;
  end if;
  select
      (select count(*) from public.list_entries where item_id = p_item_id) > 0
      and not exists (
        select 1 from public.list_entries
        where item_id = p_item_id and checked_at is null
      )
    into v_all_checked;
  -- Bump updated_at (but not version): the expiry change must reach delta
  -- catch-up reads, which poll `updated_at > since`.
  if v_all_checked then
    update public.items
    set keep_until = now() + interval '2 days',
        updated_at = now()
    where id = p_item_id;
  else
    update public.items
    set keep_until = null,
        updated_at = now()
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
  -- A retry of the same id returns the stored row before the rate and cap
  -- checks, so re-sending an already-added entry still succeeds on a full list.
  select * into v_entry
  from public.list_entries
  where id = p_id and item_id = p_item_id;
  if v_entry.id is not null then
    return v_entry;
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
  if p_checked is null then
    raise exception 'invalid_input';
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
  -- Idempotent: a repeated tick/untick must not push the list lifetime again.
  if (v_entry.checked_at is not null) = p_checked then
    return;
  end if;
  perform public.hit_rate_limit('item_write', 600, interval '1 hour');
  if p_checked then
    update public.list_entries
    set checked_at = now(),
        checked_by = auth.uid(),
        updated_at = now()
    where id = p_id;
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
  perform public.hit_rate_limit('item_write', 600, interval '1 hour');
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
  -- Serialise with ticks, and refuse to touch an entry of a removed list.
  select * into v_parent from public.items where id = v_entry.item_id for update;
  if v_parent.id is null or v_parent.deleted_at is not null then
    raise exception 'not_found';
  end if;
  select * into v_entry from public.list_entries where id = p_id for update;
  perform public.hit_rate_limit('item_write', 600, interval '1 hour');
  delete from public.list_entries where id = p_id;
  perform public.run_list_lifetime(v_entry.item_id);
end;
$$;

-- Atomic list edit: the title/colour and all entry adds/edits/removes in one
-- transaction, version-checked. The client's Save is therefore all-or-nothing
-- (a partial failure can't leave duplicate or missing rows).
create function public.edit_list(
  p_item_id uuid,
  p_expected_version integer,
  p_title text,
  p_color public.item_color,
  p_body text default null,
  p_adds jsonb default null,
  p_edits jsonb default null,
  p_removes uuid[] default null
)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_row public.items%rowtype;
  v_rows integer;
  v_e record;
  v_eid text;
  v_etext text;
  v_total integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_row from public.items where id = p_item_id for update;
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
  if v_row.type != 'list' then
    raise exception 'invalid_input';
  end if;
  if v_row.version != p_expected_version then
    raise exception 'version_conflict';
  end if;
  if p_title is not null and char_length(p_title) > 120 then
    raise exception 'invalid_input';
  end if;
  if p_body is not null and char_length(p_body) > 2000 then
    raise exception 'invalid_input';
  end if;
  if p_color is null then
    raise exception 'invalid_input';
  end if;
  if p_adds is not null and jsonb_typeof(p_adds) != 'array' then
    raise exception 'invalid_input';
  end if;
  if p_edits is not null and jsonb_typeof(p_edits) != 'array' then
    raise exception 'invalid_input';
  end if;
  -- The resulting list must stay within the 500-entry cap.
  select count(*)::integer into v_total
  from public.list_entries where item_id = p_item_id;
  v_total := v_total
    + coalesce(jsonb_array_length(p_adds), 0)
    - coalesce(array_length(p_removes, 1), 0);
  if v_total > 500 then
    raise exception 'invalid_input';
  end if;
  perform public.hit_rate_limit('item_write', 600, interval '1 hour');

  if p_removes is not null then
    delete from public.list_entries
    where item_id = p_item_id and id = any (p_removes);
  end if;

  if p_edits is not null then
    for v_e in select value from jsonb_array_elements(p_edits) loop
      if jsonb_typeof(v_e.value) != 'object' then
        raise exception 'invalid_input';
      end if;
      v_eid := v_e.value ->> 'id';
      v_etext := v_e.value ->> 'text';
      if v_eid is null
         or v_eid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'invalid_input';
      end if;
      if v_etext is null or char_length(btrim(v_etext)) not between 1 and 200 then
        raise exception 'invalid_input';
      end if;
      update public.list_entries
      set text = btrim(v_etext), updated_at = now()
      where id = v_eid::uuid and item_id = p_item_id;
    end loop;
  end if;

  if p_adds is not null then
    for v_e in select value from jsonb_array_elements(p_adds) loop
      if jsonb_typeof(v_e.value) != 'object' then
        raise exception 'invalid_input';
      end if;
      v_eid := v_e.value ->> 'id';
      v_etext := v_e.value ->> 'text';
      if v_eid is null
         or v_eid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'invalid_input';
      end if;
      if v_etext is null or char_length(btrim(v_etext)) not between 1 and 200 then
        raise exception 'invalid_input';
      end if;
      -- The id must not already belong to another item's entry.
      if exists (
        select 1 from public.list_entries
        where id = v_eid::uuid and item_id <> p_item_id
      ) then
        raise exception 'invalid_input';
      end if;
      insert into public.list_entries (id, item_id, board_id, text, position, created_by)
      values (
        v_eid::uuid, p_item_id, v_row.board_id, btrim(v_etext),
        (select coalesce(max(position), -1) + 1
         from public.list_entries where item_id = p_item_id),
        auth.uid()
      )
      on conflict (id) do nothing;
    end loop;
  end if;

  -- Authoritative cap check: the pre-check above subtracted p_removes without
  -- verifying those ids belong to this list, so a batch could otherwise sneak
  -- past 500. Recount what is actually there.
  select count(*)::integer into v_total
  from public.list_entries where item_id = p_item_id;
  if v_total > 500 then
    raise exception 'invalid_input';
  end if;

  update public.items
  set title = p_title,
      color = p_color,
      body = p_body,
      updated_by = auth.uid(),
      updated_at = now(),
      version = v_row.version + 1
  where id = p_item_id and version = p_expected_version;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'version_conflict';
  end if;
  perform public.run_list_lifetime(p_item_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: every API function above, authenticated only.
-- Helpers (hit_rate_limit, promote_longest_member, run_list_lifetime) stay
-- ungranted: nested use only.
-- ---------------------------------------------------------------------------

revoke all on function public.update_profile(text, text, boolean) from public, anon;
grant execute on function public.update_profile(text, text, boolean) to authenticated;

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

revoke all on function public.report_post(uuid, text) from public, anon;
grant execute on function public.report_post(uuid, text) to authenticated;
revoke all on function public.list_reported_items(uuid) from public, anon;
grant execute on function public.list_reported_items(uuid) to authenticated;
revoke all on function public.dismiss_reports(uuid) from public, anon;
grant execute on function public.dismiss_reports(uuid) to authenticated;
revoke all on function public.block_member(uuid, uuid) from public, anon;
grant execute on function public.block_member(uuid, uuid) to authenticated;
revoke all on function public.unblock_member(uuid, uuid) from public, anon;
grant execute on function public.unblock_member(uuid, uuid) to authenticated;
revoke all on function public.list_blocked(uuid) from public, anon;
grant execute on function public.list_blocked(uuid) to authenticated;

revoke all on function public.start_photo_upload(uuid, uuid) from public, anon;
grant execute on function public.start_photo_upload(uuid, uuid) to authenticated;

revoke all on function public.post_item(uuid, uuid, item_type, item_color, text, text, timestamptz, text, text, boolean, jsonb) from public, anon;
grant execute on function public.post_item(uuid, uuid, item_type, item_color, text, text, timestamptz, text, text, boolean, jsonb) to authenticated;

revoke all on function public.edit_item(uuid, integer, text, text, timestamptz, text, item_color) from public, anon;
grant execute on function public.edit_item(uuid, integer, text, text, timestamptz, text, item_color) to authenticated;

revoke all on function public.edit_list(uuid, integer, text, item_color, text, jsonb, jsonb, uuid[]) from public, anon;
grant execute on function public.edit_list(uuid, integer, text, item_color, text, jsonb, jsonb, uuid[]) to authenticated;

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
