-- Function permissions, discovered automatically: any public function that
-- becomes client-executable without being a known API entry point fails the
-- build (so a forgotten revoke is caught).
begin;
select plan(5);

-- Trigger functions (return `trigger`) can't be called over the API and are
-- PUBLIC-executable by default, so they're excluded from both checks.
-- No other public function is executable by anon (which inherits PUBLIC).
select ok(
  (select count(*) from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prorettype <> 'pg_catalog.trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute')) = 0,
  'no callable public function is executable by anon');

-- Every callable function executable by authenticated is a known API function
-- or a policy helper. A new function that forgets its revoke fails this.
select ok(
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype <> 'pg_catalog.trigger'::regtype
      and has_function_privilege('authenticated', p.oid, 'execute')
      and p.proname not in (
        -- policy helpers
        'is_member', '_path_board_id',
        -- API
        'update_profile', 'create_board', 'rename_board', 'delete_board',
        'leave_board', 'remove_member',
        'post_item', 'edit_item', 'edit_list', 'set_pinned', 'set_done', 'keep_longer',
        'remove_item', 'restore_item', 'list_removed_items', 'set_item_position',
        'add_entry', 'set_entry_checked', 'edit_entry', 'remove_entry',
        'get_invite_link', 'reset_invite_link', 'preview_invite', 'accept_invite',
        'delete_account'
      )
  ),
  'no unexpected function is executable by authenticated');

-- Spot checks that the dangerous helpers really are closed.
select ok(not has_function_privilege('authenticated', 'public.invite_key()', 'execute'),
  'invite_key is not executable by authenticated');
select ok(not has_function_privilege('authenticated', 'public.expired_for_purge(integer)', 'execute'),
  'expired_for_purge is not executable by authenticated');

-- run_edge_job can queue outbound requests with a secret; clients must not.
select ok(not has_function_privilege('authenticated', 'public.run_edge_job(text)', 'execute'),
  'run_edge_job is not executable by authenticated');

select * from finish();
rollback;
