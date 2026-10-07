-- Moderation + attribution hardening (follow-ups to ...19_magnets_stickers,
-- ...20_shared_post and ...21_remove_item_author_owner).
--
-- ADD-ONLY migration (freeze in effect since the 2026-09-28 first push):
-- replaces function bodies only, never edits earlier files. Apply with
-- `supabase migration up`; never reset hosted.
--
-- 1. remove_magnet: the placer OR a board owner may remove (was: placer
--    only). Rows whose placer is gone (placed_by NULL after account deletion)
--    are owner-only, so they can never become permanent or squat the
--    24-magnet cap. Matches docs/prd-magents-stickers.md §9.
-- 2. post_shared_item: attribution is stamped only onto the caller's own
--    row. post_item returns the existing row when p_id is already taken, so
--    without a gate a member could rewrite another member's attribution.
-- 3. restore_item: only the member who removed the post, or a current board
--    owner, may restore it (was: any member). Expiry-purge rows
--    (deleted_by NULL) are owner-only.
-- 4. board_can_use: the caller must be a current member (was: any signed-in
--    user could probe any board's pack entitlements).

-- ---------------------------------------------------------------------------
-- 1. Magnet moderation: placer or owner.
-- ---------------------------------------------------------------------------

create or replace function public.remove_magnet(p_id uuid)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_row public.board_magnets%rowtype;
  v_caller_role public.member_role;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_row from public.board_magnets where id = p_id for update;
  if v_row.id is null then
    raise exception 'not_found';
  end if;
  if not public.is_member(v_row.board_id) then
    raise exception 'not_member';
  end if;
  -- Placer or board owner ("Only the person who put it there — or the fridge
  -- owner — can take it off."). Owner-only when the placer is gone
  -- (placed_by NULL), so orphaned magnets never become permanent.
  if v_row.placed_by is distinct from auth.uid() then
    select role into v_caller_role
    from public.board_members
    where board_id = v_row.board_id and user_id = auth.uid();
    if v_caller_role is distinct from 'owner' then
      raise exception 'not_allowed';
    end if;
  end if;
  perform public.hit_rate_limit('item_write', 600, interval '1 hour');
  delete from public.board_magnets where id = p_id;
end;
$$;

revoke all on function public.remove_magnet(uuid) from public, anon;
grant execute on function public.remove_magnet(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Shared-post attribution: only the caller's own row.
-- ---------------------------------------------------------------------------

create or replace function public.post_shared_item(
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
  p_entries jsonb default null,
  p_shared_from_app text default null,
  p_shared_from_author text default null
)
returns public.items
language plpgsql
security definer
set search_path = '' as $$
declare
  v_item public.items%rowtype;
  v_app text;
  v_author text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  v_app := case
    when p_shared_from_app is null then null
    else nullif(btrim(p_shared_from_app), '')
  end;
  v_author := case
    when p_shared_from_author is null then null
    else nullif(btrim(p_shared_from_author), '')
  end;
  if v_app is not null and char_length(v_app) > 120 then
    raise exception 'invalid_input';
  end if;
  if v_author is not null and char_length(v_author) > 120 then
    raise exception 'invalid_input';
  end if;
  select * into v_item
  from public.post_item(
    p_id, p_board_id, p_type, p_color, p_body, p_title,
    p_event_at, p_place, p_photo_path, p_pinned, p_entries
  );
  -- post_item returns the existing row when p_id is already taken (same-id
  -- retry, or someone else's item): the attribution update below must never
  -- touch a row this caller did not create. Retries pass (same author), a
  -- hijack of another member's post fails instead of returning their row.
  if v_item.created_by is distinct from auth.uid() then
    raise exception 'invalid_input';
  end if;
  if v_app is not null or v_author is not null then
    update public.items
    set shared_from_app = v_app,
        shared_from_author = v_author
    where id = p_id and board_id = p_board_id and created_by = auth.uid();
    select * into v_item from public.items where id = p_id;
  end if;
  return v_item;
end;
$$;

revoke all on function public.post_shared_item(uuid, uuid, public.item_type, public.item_color, text, text, timestamptz, text, text, boolean, jsonb, text, text) from public, anon;
grant execute on function public.post_shared_item(uuid, uuid, public.item_type, public.item_color, text, text, timestamptz, text, text, boolean, jsonb, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Restore: deleter or current owner only.
-- ---------------------------------------------------------------------------

create or replace function public.restore_item(p_id uuid)
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
  if v_row.deleted_at is null then
    return; -- nothing to restore
  end if;
  -- Only the member who removed the post, or a current board owner, may
  -- bring it back: otherwise any member could undo another member's (or the
  -- owner's) moderation. Expiry-purge rows (deleted_by NULL) are owner-only.
  if v_row.deleted_by is distinct from auth.uid() then
    select role into v_caller_role
    from public.board_members
    where board_id = v_row.board_id and user_id = auth.uid();
    if v_caller_role is distinct from 'owner' then
      raise exception 'not_allowed';
    end if;
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

revoke all on function public.restore_item(uuid) from public, anon;
grant execute on function public.restore_item(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. board_can_use: caller must be a current member.
-- ---------------------------------------------------------------------------

create or replace function public.board_can_use(p_board_id uuid, p_pack_id text)
returns boolean
language sql
stable
security definer
set search_path = '' as $$
  select
    public.is_member(p_board_id)
    and (
      p_pack_id = 'starter'
      or exists (
        select 1
        from public.board_members m
        join public.user_entitlements e on e.user_id = m.user_id
        join public.boards b on b.id = m.board_id
        where m.board_id = p_board_id
          and e.pack_id = p_pack_id
          and e.revoked_at is null
          and b.deleted_at is null
      )
    );
$$;

revoke all on function public.board_can_use(uuid, text) from public, anon;
grant execute on function public.board_can_use(uuid, text) to authenticated;
