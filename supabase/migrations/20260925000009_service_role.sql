-- The scheduled Edge Functions run as service_role. With explicit grants only
-- (auto_expose_new_tables=false), service_role had no access to the new
-- objects, so `purge` and `cleanup-users` silently did nothing. Grant exactly
-- what those jobs need:
--   * expired_for_purge()  — purge's candidate list
--   * select/delete on items         — purge removes rows + reads photo_path
--   * select on board_members        — cleanup-users/delete-account check
grant usage on schema public to service_role;

grant execute on function public.expired_for_purge(integer) to service_role;

grant select, delete on public.items to service_role;
grant select on public.board_members to service_role;
