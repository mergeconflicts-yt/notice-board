-- The Edge-Function jobs run as service_role; pin the access they need.
begin;
select plan(8);

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

select * from finish();
rollback;
