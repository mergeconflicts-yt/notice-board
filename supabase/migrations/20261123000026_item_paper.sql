-- Paper style chosen in the note composer (items.paper_style, added in
-- 20261003000019_magnets_stickers.sql as an unused column).
--
-- ADD-ONLY migration (freeze in effect). `paper_style` stores a composite
-- '<pack_id>:<paper_id>' key because paper ids such as `canary` repeat across
-- packs. Create goes through one atomic RPC so a note can never be posted with
-- an unvalidated paper, and editing a note keeps its paper untouched.

create function public.post_item_with_paper(
  p_id uuid,
  p_board_id uuid,
  p_type public.item_type,
  p_color public.item_color,
  p_body text,
  p_title text,
  p_event_at timestamptz,
  p_place text,
  p_photo_path text,
  p_pinned boolean,
  p_entries jsonb,
  p_paper_style text
)
returns public.items
language plpgsql
security definer
set search_path = '' as $$
declare
  v_item public.items%rowtype;
  v_pack text;
  v_paper text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_member(p_board_id) then
    raise exception 'not_member';
  end if;

  if p_paper_style is not null then
    if position(':' in p_paper_style) = 0 then
      raise exception 'unknown_paper';
    end if;
    v_pack := split_part(p_paper_style, ':', 1);
    v_paper := split_part(p_paper_style, ':', 2);
    if v_pack = '' or v_paper = '' then
      raise exception 'unknown_paper';
    end if;
    if not public.board_can_use(p_board_id, v_pack) then
      raise exception 'not_entitled';
    end if;
    if not exists (
      select 1
      from public.pack_catalog pc
      cross join lateral jsonb_array_elements(
        coalesce(pc.spec -> 'papers', '[]'::jsonb)
      ) as p(paper)
      where pc.id = v_pack
        and pc.status = 'live'
        and coalesce(p.paper ->> 'id', '') = v_paper
    ) then
      raise exception 'unknown_paper';
    end if;
  end if;

  v_item := public.post_item(
    p_id, p_board_id, p_type, p_color, p_body, p_title,
    p_event_at, p_place, p_photo_path, p_pinned, p_entries
  );

  if p_paper_style is not null then
    update public.items
    set paper_style = p_paper_style,
        version = version + 1,
        updated_at = now()
    where id = p_id;
    select * into v_item from public.items where id = p_id;
  end if;

  return v_item;
end;
$$;

revoke all on function public.post_item_with_paper(
  uuid, uuid, public.item_type, public.item_color, text, text,
  timestamptz, text, text, boolean, jsonb, text
) from public, anon;
grant execute on function public.post_item_with_paper(
  uuid, uuid, public.item_type, public.item_color, text, text,
  timestamptz, text, text, boolean, jsonb, text
) to authenticated;
