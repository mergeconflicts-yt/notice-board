-- Storage abuse limits (release hardening).
--
-- 1. Avatars are never uploaded by the app (no client code writes the
--    bucket), yet every account — including the unlimited anonymous ones —
--    could push 5 MiB objects through avatars_owner_write/update and exhaust
--    the project's 1 GB free storage. Drop those client write policies; only
--    the service-role purge job touches avatars now. The shared-read policy
--    stays so existing/shared avatars still resolve.
--
-- 2. The per-account photo allowance is reduced from 1 GiB to 256 MiB. The
--    20 intents/hour rate limit and the 20-pending cap still bound the burst;
--    this lowers the ceiling one (anonymous) account can reach before being
--    refused. 256 MiB sits above the 20 × 10 MiB pending-intent worst case so
--    the hourly rate-limit test still exercises its own limit.
--    ADD-ONLY migration (freeze in effect since the 2026-09-28 first push).

drop policy if exists "avatars_owner_write" on storage.objects;
drop policy if exists "avatars_owner_update" on storage.objects;

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
