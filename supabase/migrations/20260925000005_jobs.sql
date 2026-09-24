-- Phase 6 (docs/plan.md §10): scheduled maintenance.
--
--   * expire-items          every 15 min — soft-delete keep_until lapses (SQL)
--   * cleanup-rate-limits   hourly       — delete expired rate_limits windows
--   * purge-nightly         nightly      — Edge Function purge
--   * cleanup-users-nightly nightly      — Edge Function cleanup-users
--
-- The Edge Function jobs read the functions base URL and service-role key
-- from Vault (`functions_url`, `service_role_key`) at run time — never from a
-- session setting, which any SQL session could read. Jobs are scheduled
-- unconditionally; if the secrets are absent (e.g. local dev) the job is a
-- no-op instead of never being created.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Soft-delete anything whose keep_until has passed. Returns how many lapsed.
create function public.expire_items()
returns integer
language sql
security definer
set search_path = '' as $$
  with updated as (
    update public.items
    set deleted_at = now(), deleted_by = null
    where deleted_at is null
      and keep_until is not null
      and keep_until < now()
    returning 1
  )
  select count(*)::integer from updated;
$$;

-- Items soft-deleted beyond the retention window — the purge job's work list.
-- Kept in SQL so it is testable; the Edge Function calls it with the service
-- role.
create function public.expired_for_purge(p_limit integer default 1000)
returns setof public.items
language sql
security definer
set search_path = '' as $$
  select i.*
  from public.items i
  join public.boards b on b.id = i.board_id
  where (i.deleted_at is not null and i.deleted_at < now() - interval '30 days')
     or (b.deleted_at is not null and b.deleted_at < now() - interval '30 days')
  order by i.deleted_at nulls last
  limit p_limit;
$$;

-- Every photo path currently referenced by an item (one call, no paging).
create function public.photo_paths_in_use()
returns text[]
language sql
security definer
set search_path = '' as $$
  select coalesce(array_agg(photo_path), '{}')
  from public.items
  where photo_path is not null;
$$;

-- Hard-delete a batch of items (ids passed in the POST body, not the URL).
create function public.purge_items(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = '' as $$
declare
  v_deleted integer;
begin
  delete from public.items where id = any(p_ids);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- Hard-delete boards soft-deleted > 30 days ago that have no items left (so
-- no photo can be orphaned by clock skew).
create function public.purge_boards()
returns integer
language plpgsql
security definer
set search_path = '' as $$
declare
  v_deleted integer;
begin
  delete from public.boards b
  where b.deleted_at is not null
    and b.deleted_at < now() - interval '30 days'
    and not exists (select 1 from public.items i where i.board_id = b.id);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- Clear rate-limit windows older than two hours.
create function public.cleanup_rate_limits()
returns integer
language plpgsql
security definer
set search_path = '' as $$
declare
  v_deleted integer;
begin
  delete from public.rate_limits
  where window_start < now() - interval '2 hours';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- POST to an Edge Function with the service-role key from Vault. No-op when
-- the secrets are not configured. Not callable by client roles.
create function public.run_edge_job(p_path text)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'functions_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || p_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Schedules (idempotent). Unscheduling a missing job raises, so guard it.
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    perform cron.unschedule('expire-items');
  exception when others then null;
  end;
  perform cron.schedule('expire-items', '*/15 * * * *', 'select public.expire_items()');

  begin
    perform cron.unschedule('cleanup-rate-limits');
  exception when others then null;
  end;
  perform cron.schedule('cleanup-rate-limits', '0 * * * *', 'select public.cleanup_rate_limits()');

  begin
    perform cron.unschedule('purge-nightly');
  exception when others then null;
  end;
  perform cron.schedule('purge-nightly', '0 3 * * *', 'select public.run_edge_job(''/purge'')');

  begin
    perform cron.unschedule('cleanup-users-nightly');
  exception when others then null;
  end;
  perform cron.schedule('cleanup-users-nightly', '30 3 * * *', 'select public.run_edge_job(''/cleanup-users'')');
end
$$;
