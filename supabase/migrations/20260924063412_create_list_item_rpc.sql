-- Atomically create a list item with all of its entries, so a list can
-- never be left half-written by a dropped connection mid-loop.
-- Entries arrive as [{text, position?, done?}]; positions default to order.
create or replace function public.create_list_item(
  p_board_id uuid,
  p_body text default null,
  p_paper jsonb default '{}',
  p_layout jsonb default null,
  p_expires_at timestamptz default null,
  p_entries jsonb default '[]'
)
returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_item_id uuid;
  e jsonb;
  v_pos integer := 0;
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

  insert into public.board_items (board_id, type, body, expires_at, paper, layout)
  values (p_board_id, 'list', p_body, p_expires_at,
          coalesce(p_paper, '{}'), p_layout)
  returning id into v_item_id;

  for e in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) loop
    insert into public.list_entries (board_id, item_id, text, position, is_checked)
    values (
      p_board_id,
      v_item_id,
      coalesce(e ->> 'text', ''),
      coalesce((e ->> 'position')::int, v_pos),
      coalesce((e ->> 'done')::boolean, (e ->> 'is_checked')::boolean, false)
    );
    v_pos := v_pos + 1;
  end loop;

  return v_item_id;
end;
$$;
