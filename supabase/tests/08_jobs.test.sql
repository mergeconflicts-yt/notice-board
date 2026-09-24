-- Phase 6: maintenance jobs (expire + rate-limit cleanup) and their schedule.
begin;
select plan(7);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-000000000071', 'authenticated', 'authenticated');
insert into public.boards (id, name, created_by)
values ('b0000000-0000-0000-0000-000000000071', 'Jobs', 'a0000000-0000-0000-0000-000000000071');
insert into public.board_members (board_id, user_id, role)
values ('b0000000-0000-0000-0000-000000000071', 'a0000000-0000-0000-0000-000000000071', 'owner');
insert into public.items (id, board_id, type, body, keep_until, created_by) values
  ('c0000000-0000-0000-0000-000000000071', 'b0000000-0000-0000-0000-000000000071',
   'note', 'lapsed', now() - interval '1 minute', 'a0000000-0000-0000-0000-000000000071'),
  ('c0000000-0000-0000-0000-000000000072', 'b0000000-0000-0000-0000-000000000071',
   'note', 'kept', null, 'a0000000-0000-0000-0000-000000000071');

-- Expire job.
select is(public.expire_items(), 1, 'expire_items reports one lapse');
select is(
  (select deleted_at is not null from public.items where id = 'c0000000-0000-0000-0000-000000000071'),
  true, 'lapsed item soft-deleted');
select is(
  (select count(*)::integer from public.visible_items
   where id = 'c0000000-0000-0000-0000-000000000071'),
  0, 'lapsed item hidden from the board');
select is(
  (select deleted_at is null from public.items where id = 'c0000000-0000-0000-0000-000000000072'),
  true, 'kept-forever item untouched');

-- Rate-limit sequence cleanup.
create sequence public.rl_old_test_0;
create sequence public.rl_new_test_99999999999;
select is(public.cleanup_rate_limits(), 1, 'cleanup drops exactly the stale sequence');
select is(
  (select count(*)::integer from pg_class where relname = 'rl_new_test_99999999999'),
  1, 'fresh sequence survives');

-- Schedule present.
select is(
  (select count(*)::integer from cron.job where jobname = 'expire-items'),
  1, 'expire-items is scheduled');

select * from finish();
rollback;
