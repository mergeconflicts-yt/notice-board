-- Non-members and anon are refused by every member/owner function.
-- O owns a board; S is a non-member.
begin;
select plan(30);

insert into auth.users (id, aud, role) values
  ('a0000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated');
insert into public.boards (id, name, created_by)
values ('b0000000-0000-0000-0000-0000000000b1', 'Authz', 'a0000000-0000-0000-0000-0000000000b1');
insert into public.board_members (board_id, user_id, role)
values ('b0000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-0000000000b1', 'owner');
insert into public.items (id, board_id, type, body, created_by)
values ('c0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-0000000000b1',
        'note', 'hi', 'a0000000-0000-0000-0000-0000000000b1');
insert into public.items (id, board_id, type, title, created_by)
values ('c0000000-0000-0000-0000-0000000000b2', 'b0000000-0000-0000-0000-0000000000b1',
        'list', 'L', 'a0000000-0000-0000-0000-0000000000b1');
insert into public.list_entries (id, item_id, board_id, text, position, created_by)
values ('d0000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-0000000000b2',
        'b0000000-0000-0000-0000-0000000000b1', 'x', 0, 'a0000000-0000-0000-0000-0000000000b1');

-- Anon cannot call any function.
set role anon;
select throws_ok($$select public.create_board('x', 'sage', 'UTC')$$, '42501', null, 'anon: create_board');
select throws_ok($$select public.rename_board('b0000000-0000-0000-0000-0000000000b1', 'x', 'sage')$$, '42501', null, 'anon: rename_board');
select throws_ok($$select public.post_item('e0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-0000000000b1', 'note', 'butter', 'x', null, null, null, null, false, null)$$, '42501', null, 'anon: post_item');
select throws_ok($$select public.remove_item('c0000000-0000-0000-0000-0000000000b1')$$, '42501', null, 'anon: remove_item');
select throws_ok($$select public.add_entry('f0000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-0000000000b2', 'y')$$, '42501', null, 'anon: add_entry');
reset role;

-- Stranger (authenticated, not a member) is refused by every board function.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000b2', true);
set role authenticated;
select throws_ok($$select public.rename_board('b0000000-0000-0000-0000-0000000000b1', 'x', 'sage')$$, 'P0001', 'not_member', 'stranger: rename_board');
select throws_ok($$select public.delete_board('b0000000-0000-0000-0000-0000000000b1')$$, 'P0001', 'not_member', 'stranger: delete_board');
select throws_ok($$select public.leave_board('b0000000-0000-0000-0000-0000000000b1')$$, 'P0001', 'not_member', 'stranger: leave_board');
select throws_ok($$select public.remove_member('b0000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-0000000000b1')$$, 'P0001', 'not_member', 'stranger: remove_member');
select throws_ok($$select public.post_item('e0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-0000000000b1', 'note', 'butter', 'x', null, null, null, null, false, null)$$, 'P0001', 'not_member', 'stranger: post_item');
select throws_ok($$select public.edit_item('c0000000-0000-0000-0000-0000000000b1', 1, 'x', null, null, null, 'butter')$$, 'P0001', 'not_member', 'stranger: edit_item');
select throws_ok($$select public.set_pinned('c0000000-0000-0000-0000-0000000000b1', true)$$, 'P0001', 'not_member', 'stranger: set_pinned');
select throws_ok($$select public.set_done('c0000000-0000-0000-0000-0000000000b1', true)$$, 'P0001', 'not_member', 'stranger: set_done');
select throws_ok($$select public.keep_longer('c0000000-0000-0000-0000-0000000000b1')$$, 'P0001', 'not_member', 'stranger: keep_longer');
select throws_ok($$select public.remove_item('c0000000-0000-0000-0000-0000000000b1')$$, 'P0001', 'not_member', 'stranger: remove_item');
select throws_ok($$select public.restore_item('c0000000-0000-0000-0000-0000000000b1')$$, 'P0001', 'not_member', 'stranger: restore_item');
select throws_ok($$select public.set_item_position('c0000000-0000-0000-0000-0000000000b1', 0.1, 10)$$, 'P0001', 'not_member', 'stranger: set_item_position');
select throws_ok($$select public.list_removed_items('b0000000-0000-0000-0000-0000000000b1')$$, 'P0001', 'not_member', 'stranger: list_removed_items');
select throws_ok($$select public.add_entry('f0000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-0000000000b2', 'y')$$, 'P0001', 'not_member', 'stranger: add_entry');
select throws_ok($$select public.set_entry_checked('d0000000-0000-0000-0000-0000000000b1', true)$$, 'P0001', 'not_member', 'stranger: set_entry_checked');
select throws_ok($$select public.edit_entry('d0000000-0000-0000-0000-0000000000b1', 'y')$$, 'P0001', 'not_member', 'stranger: edit_entry');
select throws_ok($$select public.remove_entry('d0000000-0000-0000-0000-0000000000b1')$$, 'P0001', 'not_member', 'stranger: remove_entry');
select throws_ok($$select public.get_invite_link('b0000000-0000-0000-0000-0000000000b1')$$, 'P0001', 'not_member', 'stranger: get_invite_link');
select throws_ok($$select public.reset_invite_link('b0000000-0000-0000-0000-0000000000b1')$$, 'P0001', 'not_member', 'stranger: reset_invite_link');
reset role;

-- Member (not owner) is refused owner-only actions.
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000b2', true);
reset role;
insert into public.board_members (board_id, user_id, role)
values ('b0000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-0000000000b2', 'member');
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000b2', true);
set role authenticated;
select throws_ok($$select public.rename_board('b0000000-0000-0000-0000-0000000000b1', 'x', 'sage')$$, 'P0001', 'not_owner', 'member: rename_board');
select throws_ok($$select public.delete_board('b0000000-0000-0000-0000-0000000000b1')$$, 'P0001', 'not_owner', 'member: delete_board');
select throws_ok($$select public.remove_member('b0000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-0000000000b1')$$, 'P0001', 'not_owner', 'member: remove_member');
select throws_ok($$select public.reset_invite_link('b0000000-0000-0000-0000-0000000000b1')$$, 'P0001', 'not_owner', 'member: reset_invite_link');
-- Members may do the rest.
select lives_ok($$select public.set_pinned('c0000000-0000-0000-0000-0000000000b1', true)$$, 'member: set_pinned allowed');
select lives_ok($$select public.add_entry('f0000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-0000000000b2', 'y')$$, 'member: add_entry allowed');
reset role;

select * from finish();
rollback;
