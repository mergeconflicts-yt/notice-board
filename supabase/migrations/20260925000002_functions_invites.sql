-- Notice Board backend, phase 1c (docs/plan.md): invite RPC functions.
--
-- One active link per board (partial unique index), valid 7 days. The link
-- token (16 random bytes, base64url) plus a short fallback code (10 chars
-- from a 32-char alphabet, shown XXXXX-XXXXX) are picked from
-- gen_random_bytes; 256 is a multiple of 32 so the code has no bias. Only
-- SHA-256 hashes are stored; the plaintext pair is encrypted with
-- pgp_sym_encrypt under the key in the Vault secret 'invite', so members
-- can re-share the same link without rotating it.
--
-- The Vault secret is NOT created here: it must exist before these
-- functions can run (local dev and tests create it; production gets a real
-- secret via the dashboard/Vault, see phase 6 docs). Without it the invite
-- functions raise a plain error the app maps to a generic message.
-- "Any user" below means any signed-in user: the app always holds an
-- (anonymous) session, so the auth guard stays on every function.

-- Reads the invite encryption key. No grant: nested use only.
create function public.invite_key()
returns text
language plpgsql
security definer
set search_path = '' as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'invite';
  if v_key is null then
    raise exception 'invite service not configured (vault secret "invite" missing)';
  end if;
  return v_key;
end;
$$;

-- Normalises a fallback code for hashing/comparison: no dashes or spaces,
-- uppercase. Link tokens are case-sensitive and must NOT go through this.
create function public.normalise_invite_code(p_raw text)
returns text
language sql
immutable
set search_path = '' as $$
  select upper(regexp_replace(coalesce(p_raw, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- Picks the code characters. No grant: nested use only.
create function public.pick_invite_code()
returns text
language sql
security definer
set search_path = '' as $$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (get_byte(r, g) % 32) + 1, 1),
    '' order by g
  )
  from (select extensions.gen_random_bytes(10) as r) s
  cross join generate_series(0, 9) g;
$$;

create function public.get_invite_link(p_board_id uuid)
returns table (token text, code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = '' as $$
declare
  v_inv public.invites%rowtype;
  v_token text;
  v_code text;
  v_plain text;
  v_attempt integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_member(p_board_id) then
    if not exists (select 1 from public.boards where id = p_board_id) then
      raise exception 'not_found';
    end if;
    raise exception 'not_member';
  end if;
  perform public.hit_rate_limit('invite_link', 30, interval '1 hour');
  select * into v_inv
  from public.invites
  where board_id = p_board_id and revoked_at is null
  for update;
  if v_inv.id is not null and v_inv.expires_at > now() then
    -- Same link for every member: decrypt and return it.
    v_plain := extensions.pgp_sym_decrypt(v_inv.secret_enc, public.invite_key());
    v_token := split_part(v_plain, ':', 1);
    v_code := split_part(v_plain, ':', 2);
    token := v_token;
    code := substr(v_code, 1, 5) || '-' || substr(v_code, 6, 5);
    expires_at := v_inv.expires_at;
    return next;
    return;
  end if;
  if v_inv.id is not null then
    -- Expired: revoke, then fall through to a fresh link.
    update public.invites
    set revoked_at = now()
    where id = v_inv.id;
  end if;
  <<create_link>>
  loop
    v_attempt := v_attempt + 1;
    v_token := rtrim(
      translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/', '-_'),
      '='
    );
    v_code := public.pick_invite_code();
    begin
      insert into public.invites (board_id, token_hash, code_hash, secret_enc, created_by)
      values (
        p_board_id,
        extensions.digest(v_token, 'sha256'),
        extensions.digest(v_code, 'sha256'),
        extensions.pgp_sym_encrypt(v_token || ':' || v_code, public.invite_key()),
        auth.uid()
      )
      returning invites.expires_at into expires_at;
      token := v_token;
      code := substr(v_code, 1, 5) || '-' || substr(v_code, 6, 5);
      return next;
      return;
    exception when unique_violation then
      -- Lost a race: another caller just created the active invite. Return
      -- theirs rather than erroring.
      select * into v_inv
      from public.invites
      where board_id = p_board_id and revoked_at is null
      for update;
      if v_inv.id is not null and v_inv.expires_at > now() then
        v_plain := extensions.pgp_sym_decrypt(v_inv.secret_enc, public.invite_key());
        token := split_part(v_plain, ':', 1);
        v_code := split_part(v_plain, ':', 2);
        code := substr(v_code, 1, 5) || '-' || substr(v_code, 6, 5);
        expires_at := v_inv.expires_at;
        return next;
        return;
      end if;
      -- Otherwise retry with fresh bytes (or an astronomical hash collision).
      if v_attempt >= 3 then
        raise;
      end if;
    end;
  end loop create_link;
end;
$$;

create function public.reset_invite_link(p_board_id uuid)
returns void
language plpgsql
security definer
set search_path = '' as $$
declare
  v_role public.member_role;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.boards where id = p_board_id) then
    raise exception 'not_found';
  end if;
  select role into v_role
  from public.board_members
  where board_id = p_board_id and user_id = auth.uid();
  if v_role is null then
    raise exception 'not_member';
  end if;
  if v_role is distinct from 'owner' then
    raise exception 'not_owner';
  end if;
  update public.invites
  set revoked_at = now()
  where board_id = p_board_id and revoked_at is null;
end;
$$;

create function public.preview_invite(p_token_or_code text)
returns table (board_name text, invited_by text, member_first_names text[], member_count integer)
language plpgsql
security definer
set search_path = '' as $$
declare
  v_norm text := public.normalise_invite_code(p_token_or_code);
  v_inv public.invites%rowtype;
  v_board public.boards%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  -- No rate-limit here: a join calls preview then accept, so counting both
  -- would charge invite_try twice per join. accept_invite (the action that
  -- actually grants membership) is the one that counts.
  select * into v_inv
  from public.invites
  where token_hash = extensions.digest(coalesce(p_token_or_code, ''), 'sha256')
     or code_hash = extensions.digest(v_norm, 'sha256');
  -- Every failure looks identical: an empty set. Returning (instead of
  -- raising) is load-bearing: the attempt row above must COMMIT so wrong
  -- guesses count toward the rate limit. A raise would roll the count
  -- back with the failed call, making brute force unthrottleable.
  if v_inv.id is null
     or v_inv.revoked_at is not null
     or v_inv.expires_at <= now() then
    return;
  end if;
  select * into v_board
  from public.boards
  where id = v_inv.board_id and deleted_at is null;
  if v_board.id is null then
    return;
  end if;
  -- No board content: name, inviter, member first names and count only.
  board_name := v_board.name;
  select display_name into invited_by
  from public.profiles
  where id = v_inv.created_by;
  select coalesce(array_agg(split_part(p.display_name, ' ', 1) order by m.joined_at, m.user_id), '{}')
    into member_first_names
  from public.board_members m
  join public.profiles p on p.id = m.user_id
  where m.board_id = v_board.id;
  select count(*)::integer into member_count
  from public.board_members
  where board_id = v_board.id;
  return next;
end;
$$;

create function public.accept_invite(p_token_or_code text, p_display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = '' as $$
declare
  v_norm text := public.normalise_invite_code(p_token_or_code);
  v_inv public.invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  perform public.hit_rate_limit('invite_try', 10, interval '1 hour');
  select * into v_inv
  from public.invites
  where token_hash = extensions.digest(coalesce(p_token_or_code, ''), 'sha256')
     or code_hash = extensions.digest(v_norm, 'sha256')
  for update;
  -- Every failure returns NULL (see preview_invite: raising would roll back
  -- the rate-limit count this call just consumed).
  if v_inv.id is null
     or v_inv.revoked_at is not null
     or v_inv.expires_at <= now() then
    return null;
  end if;
  -- Serialise with leaves/promotions on this board, then re-check liveness.
  perform 1 from public.boards where id = v_inv.board_id for update;
  if not exists (
    select 1 from public.boards
    where id = v_inv.board_id and deleted_at is null
  ) then
    return null;
  end if;
  insert into public.board_members (board_id, user_id, role)
  values (v_inv.board_id, auth.uid(), 'member')
  on conflict (board_id, user_id) do nothing;
  if p_display_name is not null then
    if char_length(btrim(p_display_name)) not between 1 and 40 then
      raise exception 'invalid_input';
    end if;
    update public.profiles
    set display_name = btrim(p_display_name)
    where id = auth.uid();
  end if;
  return v_inv.board_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: API functions only, authenticated. Helpers stay ungranted.
-- ---------------------------------------------------------------------------

revoke all on function public.get_invite_link(uuid) from public, anon;
grant execute on function public.get_invite_link(uuid) to authenticated;

revoke all on function public.reset_invite_link(uuid) from public, anon;
grant execute on function public.reset_invite_link(uuid) to authenticated;

revoke all on function public.preview_invite(text) from public, anon;
grant execute on function public.preview_invite(text) to authenticated;

revoke all on function public.accept_invite(text, text) from public, anon;
grant execute on function public.accept_invite(text, text) to authenticated;
