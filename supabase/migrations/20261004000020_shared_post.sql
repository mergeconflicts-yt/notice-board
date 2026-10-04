-- Shared-post attribution (share WhatsApp → board).
--
-- ADD-ONLY migration (freeze in effect since the 2026-09-28 first push).
-- Two nullable columns plus a wrapper RPC around post_item, so the original
-- function (and every existing caller) is untouched. Apply incrementally with
-- `supabase migration up`; never reset hosted.

alter table public.items
  add column if not exists shared_from_app text check (
    shared_from_app is null or char_length(shared_from_app) between 1 and 120
  );

alter table public.items
  add column if not exists shared_from_author text check (
    shared_from_author is null or char_length(shared_from_author) between 1 and 120
  );

-- Post an item with "Shared from <app> · <author>" attribution. Reuses
-- post_item for all validation/quotas, then stamps the attribution on the
-- row it just created (same transaction, so a failure leaves no bare post).
create function public.post_shared_item(
  p_id uuid,
  p_board_id uuid,
  p_type public.item_type,
  p_color public.item_color,
  p_body text,
  p_title text,
  p_event_at timestamptz,
  p_place text,
  p_photo_path text,
  p_pinned boolean default false,
  p_entries jsonb default null,
  p_shared_from_app text default null,
  p_shared_from_author text default null
)
returns public.items
language plpgsql
security definer
set search_path = '' as $$
declare
  v_item public.items%rowtype;
  v_app text;
  v_author text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  v_app := case
    when p_shared_from_app is null then null
    else nullif(btrim(p_shared_from_app), '')
  end;
  v_author := case
    when p_shared_from_author is null then null
    else nullif(btrim(p_shared_from_author), '')
  end;
  if v_app is not null and char_length(v_app) > 120 then
    raise exception 'invalid_input';
  end if;
  if v_author is not null and char_length(v_author) > 120 then
    raise exception 'invalid_input';
  end if;
  select * into v_item
  from public.post_item(
    p_id, p_board_id, p_type, p_color, p_body, p_title,
    p_event_at, p_place, p_photo_path, p_pinned, p_entries
  );
  if v_app is not null or v_author is not null then
    update public.items
    set shared_from_app = v_app,
        shared_from_author = v_author
    where id = p_id;
    select * into v_item from public.items where id = p_id;
  end if;
  return v_item;
end;
$$;

revoke all on function public.post_shared_item(uuid, uuid, public.item_type, public.item_color, text, text, timestamptz, text, text, boolean, jsonb, text, text) from public, anon;
grant execute on function public.post_shared_item(uuid, uuid, public.item_type, public.item_color, text, text, timestamptz, text, text, boolean, jsonb, text, text) to authenticated;
