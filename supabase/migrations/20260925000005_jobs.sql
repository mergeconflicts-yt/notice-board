-- Phase 6 (docs/plan.md §10): scheduled maintenance.
--
-- Extensions + jobs:
--   * expire-items         every 15 min  — soft-delete keep_until lapses (pure SQL)
--   * cleanup-rate-limits  hourly        — drop stale rate-limit sequences
--   * purge-nightly        nightly       — Edge Function purge (hard delete + storage)
--   * cleanup-users-nightly nightly      — Edge Function cleanup-users
--
-- The two Edge-Function jobs need the functions base URL and a service-role
-- key, which are per-environment. They are scheduled only when the settings
-- `app.functions_url` and `app.service_role_key` are present, so local resets
-- (and projects without Edge Functions) still apply cleanly.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Soft-delete anything whose keep_until has passed. Returns how many lapsed.
-- Pure SQL so the schedule and tests share one implementation.
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

-- Drop rate-limit sequences for windows older than two hours. Sequence names
-- end with the window's epoch seconds (`rl_<uid>_<action>_<epoch>`).
create function public.cleanup_rate_limits()
returns integer
language plpgsql
security definer
set search_path = '' as $$
declare
  r record;
  v_epoch bigint;
  v_dropped integer := 0;
begin
  for r in
    select relname from pg_class where relkind = 'S' and relname like 'rl\_%'
  loop
    begin
      v_epoch := (regexp_replace(r.relname, '^.*_', ''))::bigint;
    exception when others then
      v_epoch := null;
    end;
    if v_epoch is not null
       and to_timestamp(v_epoch) < now() - interval '2 hours' then
      execute format('drop sequence if exists public.%I', r.relname);
      v_dropped := v_dropped + 1;
    end if;
  end loop;
  return v_dropped;
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

  -- Edge-Function jobs, only where configured.
  if coalesce(current_setting('app.functions_url', true), '') <> ''
     and coalesce(current_setting('app.service_role_key', true), '') <> '' then
    begin
      perform cron.unschedule('purge-nightly');
    exception when others then null;
    end;
    perform cron.schedule(
      'purge-nightly',
      '0 3 * * *',
      format(
        $job$select net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 120000
        )$job$,
        current_setting('app.functions_url') || '/purge'
      )
    );

    begin
      perform cron.unschedule('cleanup-users-nightly');
    exception when others then null;
    end;
    perform cron.schedule(
      'cleanup-users-nightly',
      '30 3 * * *',
      format(
        $job$select net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 120000
        )$job$,
        current_setting('app.functions_url') || '/cleanup-users'
      )
    );
  end if;
end
$$;
