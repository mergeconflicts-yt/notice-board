-- Shareable board invites. Only the hash is stored; the raw token is shown
-- once at creation. Joining happens through a transactional RPC so a
-- non-member never needs to read invite rows (RLS stays member-only).

create extension if not exists "pgcrypto" with schema extensions;

create table if not exists public.board_invites (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  token_hash text not null unique,
  created_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  max_uses integer,
  use_count integer not null default 0,
  accepted_by uuid,
  accepted_at timestamptz,
  revoked_by uuid,
  revoked_at timestamptz
);

alter table public.board_invites enable row level security;

-- Members may list their boards' invites. All writes go through the RPCs
-- below, so there are intentionally no insert/update/delete policies.
drop policy if exists "board_invites_member_read" on public.board_invites;
create policy "board_invites_member_read" on public.board_invites
  for select using (
    exists (
      select 1 from public.board_members bm
      where bm.board_id = board_invites.board_id and bm.user_id = auth.uid()
    )
  );

-- Create an invite for a board you belong to. Returns the raw token once.
create or replace function public.create_board_invite(
  p_board_id uuid,
  p_max_uses integer default null,
  p_expires_at timestamptz default null
)
returns table (invite_id uuid, token text)
language plpgsql
security definer
set search_path = public as $$
declare
  v_raw text;
  v_display text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not exists (
    select 1 from public.board_members
    where board_id = p_board_id and user_id = auth.uid()
  ) then
    raise exception 'not a board member';
  end if;
  if p_max_uses is not null and p_max_uses < 1 then
    raise exception 'max_uses must be positive';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'expiry must be in the future';
  end if;

  -- 8 unambiguous chars, displayed as XXXX-XXXX; only the hash is stored.
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '' order by s)
    into v_raw
    from generate_series(1, 8) s;
  v_display := substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4);

  return query
  insert into public.board_invites (board_id, token_hash, created_by, expires_at, max_uses)
  values (
    p_board_id,
    encode(extensions.digest(v_raw, 'sha256'), 'hex'),
    auth.uid(), p_expires_at, p_max_uses
  )
  returning board_invites.id, v_display;
end;
$$;

-- Accept an invite code. Validates, joins, and counts the use atomically.
-- Rejects with a generic message so invalid/revoked/expired are indistinguishable.
create or replace function public.accept_board_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_inv public.board_invites%rowtype;
  v_norm text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  v_norm := upper(regexp_replace(coalesce(p_token, ''), '[^A-Za-z0-9]', '', 'g'));

  select * into v_inv
  from public.board_invites
  where token_hash = encode(extensions.digest(v_norm, 'sha256'), 'hex');

  if v_inv.id is null or v_inv.revoked_by is not null
     or (v_inv.expires_at is not null and v_inv.expires_at <= now()) then
    raise exception 'this invite is not valid';
  end if;
  if v_inv.max_uses is not null and v_inv.use_count >= v_inv.max_uses then
    raise exception 'this invite has already been fully used';
  end if;

  insert into public.board_members (board_id, user_id, role, invited_by)
  values (v_inv.board_id, auth.uid(), 'member', v_inv.created_by)
  on conflict (board_id, user_id) do nothing;

  update public.board_invites
  set use_count = use_count + 1,
      accepted_by = coalesce(accepted_by, auth.uid()),
      accepted_at = coalesce(accepted_at, now())
  where id = v_inv.id;

  return v_inv.board_id;
end;
$$;

-- Revoke one of your boards' invites.
create or replace function public.revoke_board_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public as $$
declare
  v_board uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select board_id into v_board from public.board_invites where id = p_invite_id;
  if v_board is null then
    raise exception 'invite not found';
  end if;
  if not exists (
    select 1 from public.board_members
    where board_id = v_board and user_id = auth.uid()
  ) then
    raise exception 'not a board member';
  end if;
  update public.board_invites
  set revoked_by = auth.uid(), revoked_at = now()
  where id = p_invite_id and revoked_by is null;
end;
$$;
