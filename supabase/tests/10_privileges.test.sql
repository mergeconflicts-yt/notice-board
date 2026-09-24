-- Helper functions must not be reachable by client roles (plan §5). Postgres
-- grants EXECUTE to PUBLIC by default; this pins the lockdown.
begin;
select plan(27);

-- Internal helpers: no client role may execute them.
select ok(not has_function_privilege('authenticated', 'public.invite_key()', 'execute'),
  'authenticated cannot execute invite_key');
select ok(not has_function_privilege('anon', 'public.invite_key()', 'execute'),
  'anon cannot execute invite_key');

select ok(not has_function_privilege('authenticated', 'public.pick_invite_code()', 'execute'),
  'authenticated cannot execute pick_invite_code');
select ok(not has_function_privilege('anon', 'public.pick_invite_code()', 'execute'),
  'anon cannot execute pick_invite_code');

select ok(not has_function_privilege('authenticated', 'public.normalise_invite_code(text)', 'execute'),
  'authenticated cannot execute normalise_invite_code');
select ok(not has_function_privilege('anon', 'public.normalise_invite_code(text)', 'execute'),
  'anon cannot execute normalise_invite_code');

select ok(not has_function_privilege('authenticated', 'public.hit_rate_limit(text, integer, interval)', 'execute'),
  'authenticated cannot execute hit_rate_limit');
select ok(not has_function_privilege('anon', 'public.hit_rate_limit(text, integer, interval)', 'execute'),
  'anon cannot execute hit_rate_limit');

select ok(not has_function_privilege('authenticated', 'public.run_list_lifetime(uuid)', 'execute'),
  'authenticated cannot execute run_list_lifetime');
select ok(not has_function_privilege('anon', 'public.run_list_lifetime(uuid)', 'execute'),
  'anon cannot execute run_list_lifetime');

select ok(not has_function_privilege('authenticated', 'public.promote_longest_member(uuid)', 'execute'),
  'authenticated cannot execute promote_longest_member');
select ok(not has_function_privilege('anon', 'public.promote_longest_member(uuid)', 'execute'),
  'anon cannot execute promote_longest_member');

select ok(not has_function_privilege('authenticated', 'public.expire_items()', 'execute'),
  'authenticated cannot execute expire_items');
select ok(not has_function_privilege('anon', 'public.expire_items()', 'execute'),
  'anon cannot execute expire_items');

select ok(not has_function_privilege('authenticated', 'public.cleanup_rate_limits()', 'execute'),
  'authenticated cannot execute cleanup_rate_limits');
select ok(not has_function_privilege('anon', 'public.cleanup_rate_limits()', 'execute'),
  'anon cannot execute cleanup_rate_limits');

select ok(not has_function_privilege(
  'authenticated',
  'public.default_keep_until(public.item_type, timestamp with time zone, boolean, timestamp with time zone, text)',
  'execute'), 'authenticated cannot execute default_keep_until');
select ok(not has_function_privilege(
  'anon',
  'public.default_keep_until(public.item_type, timestamp with time zone, boolean, timestamp with time zone, text)',
  'execute'), 'anon cannot execute default_keep_until');

select ok(not has_function_privilege('authenticated', 'public.run_edge_job(text)', 'execute'),
  'authenticated cannot execute run_edge_job');
select ok(not has_function_privilege('anon', 'public.run_edge_job(text)', 'execute'),
  'anon cannot execute run_edge_job');

select ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '_shares_board_with'),
  '_shares_board_with is dropped');

-- Policy helpers stay available to authenticated (RLS/storage run as caller).
select ok(has_function_privilege('authenticated', 'public.is_member(uuid)', 'execute'),
  'authenticated can execute is_member (policy helper)');
select ok(not has_function_privilege('anon', 'public.is_member(uuid)', 'execute'),
  'anon cannot execute is_member');
select ok(has_function_privilege('authenticated', 'public._path_board_id(text)', 'execute'),
  'authenticated can execute _path_board_id (policy helper)');
select ok(not has_function_privilege('anon', 'public._path_board_id(text)', 'execute'),
  'anon cannot execute _path_board_id');

-- Public API functions are for authenticated only.
select ok(has_function_privilege('authenticated', 'public.create_board(text, text, text)', 'execute'),
  'authenticated can execute create_board');
select ok(not has_function_privilege('anon', 'public.create_board(text, text, text)', 'execute'),
  'anon cannot execute create_board');

select * from finish();
rollback;
