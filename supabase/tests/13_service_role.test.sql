-- The Edge-Function jobs run as service_role; pin the access they need.
begin;
select plan(15);

select ok(has_schema_privilege('service_role', 'public', 'usage'),
  'service_role can use schema public');
select ok(has_function_privilege('service_role', 'public.expired_for_purge(integer)', 'execute'),
  'service_role can run expired_for_purge');
select ok(has_table_privilege('service_role', 'public.items', 'select'),
  'service_role can read items');
select ok(has_table_privilege('service_role', 'public.items', 'delete'),
  'service_role can delete items');
select ok(has_table_privilege('service_role', 'public.board_members', 'select'),
  'service_role can read board_members');
select ok(has_function_privilege('service_role', 'public.photo_paths_in_use()', 'execute'),
  'service_role can run photo_paths_in_use');
select ok(has_function_privilege('service_role', 'public.purge_items(uuid[])', 'execute'),
  'service_role can run purge_items');
select ok(has_function_privilege('service_role', 'public.purge_boards()', 'execute'),
  'service_role can run purge_boards');
select ok(has_table_privilege('service_role', 'public.boards', 'select'),
  'service_role can read boards');
select ok(has_table_privilege('service_role', 'public.boards', 'delete'),
  'service_role can delete boards');
select ok(has_table_privilege('service_role', 'public.profiles', 'select'),
  'service_role can read profiles');
select ok(has_function_privilege('service_role', 'public.inactive_anonymous_user_ids(integer)', 'execute'),
  'service_role can list inactive anonymous users');
select ok(has_function_privilege('service_role', 'public.is_inactive_anonymous_user(uuid)', 'execute'),
  'service_role can re-check a candidate user');
select ok(has_function_privilege('service_role', 'public.job_failures(integer)', 'execute'),
  'service_role can read job failures');
select ok(has_function_privilege('service_role', 'public.http_failures(integer)', 'execute'),
  'service_role can read pg_net failures');

select * from finish();
rollback;
