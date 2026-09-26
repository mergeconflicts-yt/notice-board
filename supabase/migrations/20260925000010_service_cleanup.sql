-- Service-role helpers for the cleanup-users job (docs/plan.md §10).
--
-- Candidate selection joins auth.users against board_members in the database
-- (not paged over the admin API), so it scales and cannot miss a board joined
-- mid-run. "Activity" includes token refreshes and sessions, not just
-- last_sign_in_at — a refresh does not update last_sign_in_at, so relying on
-- it alone would delete active users. The Edge Function re-checks each id
-- immediately before deleting it.
--
-- Retention policy: guest (anonymous) sign-out deletes the account
-- immediately client-side, so an anonymous user found here with memberships
-- is someone who lost the device or uninstalled — not someone who signed out.
-- Those accounts are kept for 90 days of inactivity (the same window as
-- expired-post retention horizons) before deletion, giving a reinstall a
-- chance to recover; memberless anonymous accounts go after 30 days. The
-- distinction lives in the interval below: membership-holding candidates use
-- 90 days, memberless ones 30.

create function public.inactive_anonymous_user_ids(p_limit integer default 500)
returns setof uuid
language sql
security definer
set search_path = '' as $$
  select u.id
  from auth.users u
  where u.is_anonymous
    and greatest(
      coalesce(u.last_sign_in_at, u.created_at),
      coalesce(
        (select max(s.updated_at) from auth.sessions s where s.user_id = u.id),
        'epoch'::timestamptz
      ),
      coalesce(
        (select max(timezone('UTC', s.refreshed_at)) from auth.sessions s where s.user_id = u.id),
        'epoch'::timestamptz
      ),
      coalesce(
        (select max(r.updated_at) from auth.refresh_tokens r where r.user_id = u.id::text),
        'epoch'::timestamptz
      )
    ) < now() - (
      case when exists (
        select 1 from public.board_members m where m.user_id = u.id
      ) then interval '90 days' else interval '30 days' end
    )
  order by u.id
  limit greatest(p_limit, 0);
$$;

-- Re-check a single candidate immediately before the admin API deletes it, so
-- a board joined or a session refreshed since the candidate query wins. The
-- same 90/30-day membership distinction as above applies.
create function public.is_inactive_anonymous_user(p_id uuid)
returns boolean
language sql
security definer
set search_path = '' as $$
  select exists (
    select 1
    from auth.users u
    where u.id = p_id
      and u.is_anonymous
      and greatest(
        coalesce(u.last_sign_in_at, u.created_at),
        coalesce(
          (select max(s.updated_at) from auth.sessions s where s.user_id = u.id),
          'epoch'::timestamptz
        ),
        coalesce(
          (select max(timezone('UTC', s.refreshed_at)) from auth.sessions s where s.user_id = u.id),
          'epoch'::timestamptz
        ),
        coalesce(
          (select max(r.updated_at) from auth.refresh_tokens r where r.user_id = u.id::text),
          'epoch'::timestamptz
        )
      ) < now() - (
        case when exists (
          select 1 from public.board_members m where m.user_id = u.id
        ) then interval '90 days' else interval '30 days' end
      )
  );
$$;

revoke all on function public.inactive_anonymous_user_ids(integer) from public, anon, authenticated;
revoke all on function public.is_inactive_anonymous_user(uuid) from public, anon, authenticated;
grant execute on function public.inactive_anonymous_user_ids(integer) to service_role;
grant execute on function public.is_inactive_anonymous_user(uuid) to service_role;
