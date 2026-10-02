-- Project-wide board-photo storage quota (release hardening).
--
-- A 256 MiB per-account cap alone does not protect a 1 GiB free project: four
-- disposable anonymous accounts could otherwise consume it. Cap tracked
-- board-photo bytes at 768 MiB project-wide, reserving roughly 256 MiB for
-- avatars, metadata, rows, and purge timing. `photo_upload_intents` remains
-- the authoritative accounting source: consumed rows linked to live or
-- restorable items and unexpired pending rows all count, with unknown sizes
-- conservatively counted at the upload-function input cap.
--
-- The quota check and intent insert are serialized with a transaction-scoped
-- advisory lock so concurrent requests from different accounts cannot race
-- past the project ceiling. Hosted Auth IP/signup limits still need their
-- separate dashboard settings; this migration closes the storage path that
-- churned anonymous accounts can otherwise exhaust.
-- ADD-ONLY migration (freeze in effect since the 2026-09-28 first push).

create function public.project_photo_bytes_used()
returns bigint
language sql
stable
security definer
set search_path = '' as $$
  select coalesce(sum(coalesce(n.byte_size, 10485760)), 0)::bigint
  from public.photo_upload_intents n
  left join public.items i
    on i.photo_path = n.path
  where n.consumed = false or i.id is not null;
$$;

revoke all on function public.project_photo_bytes_used() from public, anon, authenticated;
grant execute on function public.project_photo_bytes_used() to service_role;

create or replace function public.start_photo_upload(p_board_id uuid, p_item_id uuid)
returns text
language plpgsql
security definer
set search_path = '' as $$
declare
  v_path text;
  v_pending integer;
  v_live_photos integer;
  v_used_bytes bigint;
  v_project_bytes bigint;
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
  perform public.hit_rate_limit('photo_upload', 20, interval '1 hour');
  select count(*)::integer into v_pending
  from public.photo_upload_intents
  where user_id = auth.uid() and consumed = false and expires_at > now();
  if v_pending >= 20 then
    raise exception 'rate_limited';
  end if;
  -- Per-account storage quota: linked photos (measured post re-encode) plus
  -- pending intent bytes. Soft-deleted items keep counting: their objects
  -- remain stored and restorable for 30 days. Unknown sizes (legacy rows,
  -- in-flight uploads) count at the bucket cap so they cannot hide usage.
  select coalesce(sum(coalesce(n.byte_size, 10485760)), 0)::bigint into v_used_bytes
  from public.photo_upload_intents n
  left join public.items i
    on i.photo_path = n.path
  where n.user_id = auth.uid()
    and (n.consumed = false or i.id is not null);
  if v_used_bytes >= 268435456 then
    raise exception 'rate_limited';
  end if;
  -- Serialize issuance across accounts before applying the project ceiling.
  perform pg_advisory_xact_lock(8200217470170624573);
  select public.project_photo_bytes_used() into v_project_bytes;
  if v_project_bytes >= 805306368 then
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

revoke all on function public.start_photo_upload(uuid, uuid) from public, anon;
grant execute on function public.start_photo_upload(uuid, uuid) to authenticated;
