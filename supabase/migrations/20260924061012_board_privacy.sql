-- Board privacy: boards and memberships are visible only to members, and
-- membership rows can only be created through the validated RPCs
-- (create_board for the founding owner, accept_board_invite for joiners).
-- Direct client inserts into board_members are no longer allowed.

-- Membership check that bypasses RLS (definer) so policies can safely
-- reference it without recursing.
create or replace function public.is_board_member(p_board_id uuid)
returns boolean
language sql
security definer
set search_path = public as $$
  select exists (
    select 1 from public.board_members
    where board_id = p_board_id and user_id = auth.uid()
  );
$$;

-- Boards: members only. (Creation goes through create_board below.)
drop policy if exists "boards_read" on public.boards;
drop policy if exists "boards_insert" on public.boards;

create policy "boards_member_read" on public.boards
  for select using (public.is_board_member(id));

-- Members: visible only within boards you belong to. No direct inserts;
-- join via accept_board_invite, founding membership via create_board.
drop policy if exists "members_read" on public.board_members;
drop policy if exists "members_insert" on public.board_members;

create policy "board_members_member_read" on public.board_members
  for select using (public.is_board_member(board_id));

-- Create a board plus its founding owner membership, atomically.
-- Returns the new board row.
create or replace function public.create_board(p_name text)
returns public.boards
language plpgsql
security definer
set search_path = public as $$
declare
  v_board public.boards%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'board name is required';
  end if;

  insert into public.boards (name)
  values (btrim(p_name))
  returning * into v_board;

  insert into public.board_members (board_id, user_id, role)
  values (v_board.id, auth.uid(), 'owner');

  return v_board;
end;
$$;
