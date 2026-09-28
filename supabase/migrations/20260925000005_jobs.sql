-- Phase 6 (docs/plan.md §10): scheduled maintenance.
--
--   * expire-items          every 15 min — soft-delete keep_until lapses (SQL)
--   * cleanup-rate-limits   hourly       — delete expired rate_limits windows
--   * cleanup-invites       hourly       — delete stale invite rows
--   * cleanup-upload-intents hourly      — sweep expired upload intents
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

-- Every photo path currently referenced by an item, plus the authoritative
-- row count from the same snapshot (one call, no paging). A single aggregate
-- row, deliberately: PostgREST caps function results at max_rows (1000), so a
-- one-row-per-photo shape would truncate above that and fail the count guard
-- below on every run. The count guards against acting on a short list.
create function public.photo_paths_in_use()
returns table (paths text[], total bigint)
language sql
security definer
set search_path = '' as $$
  select coalesce(array_agg(i.photo_path), '{}'),
         count(*)::bigint
  from public.items i
  where i.photo_path is not null;
$$;

-- Hard-delete a batch of items (ids passed in the POST body, not the URL).
-- Also drops the upload-intent accounting rows for their photos: the purge
-- job deletes the storage objects BEFORE calling this, so the bytes stop
-- counting exactly when they stop existing.
create function public.purge_items(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = '' as $$
declare
  v_deleted integer;
begin
  delete from public.photo_upload_intents n
  using public.items i
  where i.id = any(p_ids)
    and i.photo_path is not null
    and n.path = i.photo_path;
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

-- Drop invite rows that have been revoked or expired for over a week. They are
-- never needed again (get_invite_link rotates expired links), so keep the
-- table from growing forever.
create function public.purge_stale_invites()
returns integer
language plpgsql
security definer
set search_path = '' as $$
declare
  v_deleted integer;
begin
  delete from public.invites
  where (revoked_at is not null and revoked_at < now() - interval '7 days')
     or (expires_at < now() - interval '7 days');
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- Sweep expired upload-intent accounting rows. Rows survive while their
-- bytes may still exist (see function body); the orphan-photo sweeper
-- removes unlinked objects on its own 24h horizon.
create function public.purge_stale_upload_intents()
returns integer
language plpgsql
security definer
set search_path = '' as $$
declare
  v_deleted integer;
begin
  -- Accounting rows live until the bytes stop existing:
  --   * referenced by any item (live or soft-deleted, i.e. restorable) → keep;
  --   * unreferenced (never linked, or item already purged) → keep for 25h
  --     past expiry, covering the orphan-photo sweeper's 24h horizon, then
  --     drop. Intent rows for purged items are removed by purge_items itself.
  delete from public.photo_upload_intents n
  where n.expires_at < now() - interval '25 hours'
    and not exists (
      select 1 from public.items i where i.photo_path = n.path
    );
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- POST to an Edge Function with a dedicated job secret from Vault. No-op (with
-- a warning) when the secrets are not configured. Not callable by client roles.
--
-- `job_secret` is deliberately separate from the service-role key: pg_net keeps
-- queued request headers (including the bearer token) in `net.http_request_queue`
-- until delivery, so a leaked/over-scoped service key there would be far worse.
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
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'job_secret';
  if v_url is null or v_key is null then
    raise warning 'run_edge_job(%): Vault secrets "functions_url" and "job_secret" are required; skipping', p_path;
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

-- pg_net's `net` schema is owned by supabase_admin, and migrations run as
-- `postgres`, so its grants to anon/authenticated cannot be revoked here (a
-- REVOKE is a no-op with a warning). Exposure is instead contained by
-- `api.schemas = ["public", "graphql_public"]` + `auto_expose_new_tables =
-- false`: PostgREST never routes to `net`. The secrets it carries are also
-- isolated — run_edge_job uses a dedicated `job_secret`, not the service key.
-- If desired, revoke `net` EXECUTE/USAGE as supabase_admin in the hosted
-- project's SQL editor.

-- Diagnostics: surface job failures instead of letting them vanish into
-- cron/net internals. Service-role only (they reveal internal endpoints).
create function public.job_failures(p_since_hours integer default 24)
returns table (jobname text, status text, return_message text, start_time timestamptz)
language sql
security definer
set search_path = '' as $$
  select j.jobname, d.status, d.return_message, d.start_time
  from cron.job_run_details d
  join cron.job j on j.jobid = d.jobid
  where d.status <> 'succeeded'
    and d.start_time > now() - make_interval(hours => p_since_hours)
  order by d.start_time desc;
$$;

create function public.http_failures(p_since_hours integer default 24)
returns table (id bigint, status_code integer, error_msg text, created timestamptz)
language sql
security definer
set search_path = '' as $$
  select r.id, r.status_code, r.error_msg, r.created
  from net._http_response r
  where (r.status_code is null or r.status_code >= 400 or r.error_msg is not null)
    and r.created > now() - make_interval(hours => p_since_hours)
  order by r.created desc;
$$;

revoke all on function public.job_failures(integer) from public, anon, authenticated;
revoke all on function public.http_failures(integer) from public, anon, authenticated;
grant execute on function public.job_failures(integer) to service_role;
grant execute on function public.http_failures(integer) to service_role;

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
    perform cron.unschedule('cleanup-invites');
  exception when others then null;
  end;
  perform cron.schedule('cleanup-invites', '20 * * * *', 'select public.purge_stale_invites()');

  begin
    perform cron.unschedule('cleanup-upload-intents');
  exception when others then null;
  end;
  perform cron.schedule('cleanup-upload-intents', '25 * * * *',
    'select public.purge_stale_upload_intents()');

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
