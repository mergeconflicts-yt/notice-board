-- Phase 3: private photo/avatar storage policies.
-- Roles: O owner/uploader, S stranger, M co-member.
begin;
select plan(19);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-000000000051', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000052', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000053', 'authenticated', 'authenticated');
insert into public.boards (id, name, created_by)
values ('b0000000-0000-0000-0000-000000000051', 'Photos', 'a0000000-0000-0000-0000-000000000051');
insert into public.board_members (board_id, user_id, role) values
  ('b0000000-0000-0000-0000-000000000051', 'a0000000-0000-0000-0000-000000000051', 'owner'),
  ('b0000000-0000-0000-0000-000000000051', 'a0000000-0000-0000-0000-000000000053', 'member');

-- Upload intent for the member-upload tests below (superuser bypasses RLS).
-- The storage policy only accepts the exact intent path, so the upload test
-- creates its intent first, exactly like the app does.
insert into public.photo_upload_intents (path, board_id, item_id, user_id) values
  ('b0000000-0000-0000-0000-000000000051/i2/new.jpg',
   'b0000000-0000-0000-0000-000000000051', 'i2000000-0000-0000-0000-000000000051',
   'a0000000-0000-0000-0000-000000000051');

-- Fixture objects (superuser bypasses RLS).
insert into storage.objects (bucket_id, name, owner) values
  ('board-photos', 'b0000000-0000-0000-0000-000000000051/i1/photo.jpg',
   'a0000000-0000-0000-0000-000000000051'),
  ('board-photos', 'not-a-uuid/i1/photo.jpg',
   'a0000000-0000-0000-0000-000000000051'),
  ('avatars', 'a0000000-0000-0000-0000-000000000051/me.jpg',
   'a0000000-0000-0000-0000-000000000051');

-- Helper: malformed path denies instead of erroring.
select is(public._path_board_id('not-a-uuid/x.jpg'), null, 'malformed path -> null');
select is(
  public._path_board_id('000000000000000000000000000000000000/x.jpg'),
  null, '36-char non-uuid path -> null, not a cast error');
select is(
  public._path_board_id('b0000000-0000-0000-0000-000000000051/x/y.jpg'),
  'b0000000-0000-0000-0000-000000000051'::uuid,
  'valid path -> board id');

-- Member reads their board's photo and own avatar; malformed stays hidden.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000051', true);
set role authenticated;
select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'board-photos' and name like 'b0000000%'),
  1, 'member reads board photo');
select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'board-photos' and name like 'not-a-uuid%'),
  0, 'malformed path is denied');
select is(
  (select count(*)::integer from storage.objects where bucket_id = 'avatars'),
  1, 'owner reads own avatar');
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    values ('board-photos', 'b0000000-0000-0000-0000-000000000051/i2/new.jpg',
            'a0000000-0000-0000-0000-000000000051')$$,
  'member uploads to their live intent path');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    values ('board-photos', 'b0000000-0000-0000-0000-000000000051/i2/bypass.jpg',
            'a0000000-0000-0000-0000-000000000051')$$,
  '42501', null, 'member cannot upload outside an intent path');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    values ('board-photos', 'b0000000-0000-0000-0000-000000000051/i2/new.png',
            'a0000000-0000-0000-0000-000000000051')$$,
  '42501', null, 'non-jpg upload rejected (intents only issue .jpg)');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    values ('board-photos', 'c0000000-0000-0000-0000-000000000051/i2/x.jpg',
            'a0000000-0000-0000-0000-000000000051')$$,
  '42501', null, 'cannot upload into a foreign board folder');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    values ('board-photos', 'b0000000-0000-0000-0000-000000000051/i2/spoof.jpg',
            'a0000000-0000-0000-0000-000000000053')$$,
  '42501', null, 'cannot spoof the object owner');
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    values ('avatars', 'a0000000-0000-0000-0000-000000000051/new.jpg',
            'a0000000-0000-0000-0000-000000000051')$$,
  'owner writes own avatar');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    values ('avatars', 'a0000000-0000-0000-0000-000000000052/x.jpg',
            'a0000000-0000-0000-0000-000000000051')$$,
  '42501', null, 'cannot write another user''s avatar folder');
reset role;

-- Stranger reads nothing.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000052', true);
set role authenticated;
select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'board-photos' and name like 'b0000000%'),
  0, 'stranger reads no board photos');
select is(
  (select count(*)::integer from storage.objects where bucket_id = 'avatars'),
  0, 'stranger reads no avatars');
reset role;

-- Co-member (shares a board) reads the owner's avatar.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000053', true);
set role authenticated;
select ok(
  (select count(*)::integer from storage.objects where bucket_id = 'avatars') >= 1,
  'co-member reads shared avatar');
select ok(
  (select count(*)::integer from storage.objects
   where bucket_id = 'board-photos' and name like 'b0000000%') >= 1,
  'co-member reads board photo');
reset role;

-- Soft-delete the board: the lingering membership no longer exposes the
-- owner's avatar or photos.
update public.boards set deleted_at = now()
where id = 'b0000000-0000-0000-0000-000000000051';
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000053', true);
set role authenticated;
select is(
  (select count(*)::integer from storage.objects where bucket_id = 'avatars'),
  0, 'deleted-board membership exposes no avatars');
select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'board-photos' and name like 'b0000000%'),
  0, 'deleted-board membership exposes no photos');
reset role;

select * from finish();
rollback;
