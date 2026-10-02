-- Project-wide photo storage quota: one low-usage account cannot issue an
-- upload intent after tracked board-photo bytes reach the 768 MiB project
-- ceiling, even though that caller is below the 256 MiB per-account cap.
begin;
select plan(5);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-0000000000e2', 'authenticated', 'authenticated');
insert into public.boards (id, name, created_by)
values ('b0000000-0000-0000-0000-0000000000e1', 'Quota', 'a0000000-0000-0000-0000-0000000000e1');
insert into public.board_members (board_id, user_id, role)
values ('b0000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-0000000000e1', 'owner');
insert into public.items (id, board_id, type, photo_path, created_by) values
  ('c0000000-0000-0000-0000-0000000000e1', 'b0000000-0000-0000-0000-0000000000e1',
   'photo', 'b0000000-0000-0000-0000-0000000000e1/c0000000-0000-0000-0000-0000000000e1/full.jpg',
   'a0000000-0000-0000-0000-0000000000e2');
insert into public.photo_upload_intents (path, board_id, item_id, user_id, consumed, byte_size) values
  ('b0000000-0000-0000-0000-0000000000e1/c0000000-0000-0000-0000-0000000000e1/full.jpg',
   'b0000000-0000-0000-0000-0000000000e1', 'c0000000-0000-0000-0000-0000000000e1',
   'a0000000-0000-0000-0000-0000000000e2', true, 805306368);

select ok(has_function_privilege('service_role', 'public.project_photo_bytes_used()', 'execute'),
  'service_role can read project storage usage');
select ok(not has_function_privilege('authenticated', 'public.project_photo_bytes_used()', 'execute'),
  'authenticated cannot read project storage usage');
select ok(not has_function_privilege('anon', 'public.project_photo_bytes_used()', 'execute'),
  'anon cannot read project storage usage');

set role service_role;
select is(public.project_photo_bytes_used(), 805306368::bigint,
  'project usage counts the tracked 768 MiB');
reset role;

select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000e1', true);
set role authenticated;
select throws_ok(
  $$select public.start_photo_upload('b0000000-0000-0000-0000-0000000000e1',
    'c0000000-0000-0000-0000-0000000000e2')$$,
  'P0001', 'rate_limited', 'low-usage caller is refused at the project ceiling');
reset role;

select * from finish();
rollback;
