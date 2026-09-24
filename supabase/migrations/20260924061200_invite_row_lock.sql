-- Harden accept_board_invite against races: lock the invite row so
-- concurrent joins serialise, and only consume a use when a new membership
-- was actually inserted (re-accepts by existing members are free).
create or replace function public.accept_board_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_inv public.board_invites%rowtype;
  v_norm text;
  v_inserted integer;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  v_norm := upper(regexp_replace(coalesce(p_token, ''), '[^A-Za-z0-9]', '', 'g'));

  select * into v_inv
  from public.board_invites
  where token_hash = encode(extensions.digest(v_norm, 'sha256'), 'hex')
  for update;

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
  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    update public.board_invites
    set use_count = use_count + 1,
        accepted_by = coalesce(accepted_by, auth.uid()),
        accepted_at = coalesce(accepted_at, now())
    where id = v_inv.id;
  end if;

  return v_inv.board_id;
end;
$$;
