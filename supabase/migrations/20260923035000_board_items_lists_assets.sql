-- New content model: board_items (+ realtime), list_entries (+ realtime),
-- item_assets. Old `notes` table stays untouched so current clients keep
-- working until the backend is ported.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.board_items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  type text not null default 'note',
  body text,
  event_at timestamptz,
  expires_at timestamptz,
  -- paper: {color, rotation, ...}; layout: {x, y, manual} when hand-placed.
  paper jsonb not null default '{}',
  layout jsonb,
  created_by uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz,
  completed_by uuid,
  completed_at timestamptz,
  deleted_by uuid,
  deleted_at timestamptz,
  version integer not null default 1
);

create table if not exists public.list_entries (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  item_id uuid not null references public.board_items (id) on delete cascade,
  text text not null,
  position integer not null default 0,
  is_checked boolean not null default false,
  checked_by uuid,
  checked_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz,
  deleted_by uuid,
  deleted_at timestamptz,
  version integer not null default 1
);

create table if not exists public.item_assets (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  item_id uuid not null references public.board_items (id) on delete cascade,
  storage_path text not null unique,
  mime text,
  bytes bigint,
  width integer,
  height integer,
  blurhash text,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Board security rule: every board-scoped row requires membership.
-- ---------------------------------------------------------------------------

alter table public.board_items enable row level security;
alter table public.list_entries enable row level security;
alter table public.item_assets enable row level security;

drop policy if exists "board_items_member_all" on public.board_items;
create policy "board_items_member_all" on public.board_items
  for all using (
    exists (
      select 1 from public.board_members bm
      where bm.board_id = board_items.board_id and bm.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.board_members bm
      where bm.board_id = board_items.board_id and bm.user_id = auth.uid()
    )
  );

drop policy if exists "list_entries_member_all" on public.list_entries;
create policy "list_entries_member_all" on public.list_entries
  for all using (
    exists (
      select 1 from public.board_members bm
      where bm.board_id = list_entries.board_id and bm.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.board_members bm
      where bm.board_id = list_entries.board_id and bm.user_id = auth.uid()
    )
  );

drop policy if exists "item_assets_member_all" on public.item_assets;
create policy "item_assets_member_all" on public.item_assets
  for all using (
    exists (
      select 1 from public.board_members bm
      where bm.board_id = item_assets.board_id and bm.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.board_members bm
      where bm.board_id = item_assets.board_id and bm.user_id = auth.uid()
    )
  );

-- Realtime: items + entries only (assets are fetched with their item).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'board_items'
  ) then
    alter publication supabase_realtime add table public.board_items;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'list_entries'
  ) then
    alter publication supabase_realtime add table public.list_entries;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Backfill: reshape legacy `notes` rows into the new model.
-- Mirrors the app's own list detection (marked items first, then the
-- bare "title + short lines" fallback). Text stays the source of truth.
-- ---------------------------------------------------------------------------

create or replace function public._split_marked_list(p_text text)
returns jsonb
language plpgsql immutable as $$
declare
  raw text[];
  orig text;
  l text;
  v_title text := null;
  v_items jsonb := '[]'::jsonb;
  v_done boolean;
begin
  raw := string_to_array(p_text, chr(10));
  for i in 1 .. coalesce(array_length(raw, 1), 0) loop
    orig := btrim(raw[i]);
    if orig = '' then continue; end if;
    l := orig;
    if l ~* '^\s*(\[x\]|☑|☒|✓|✔)\s+' then
      v_done := true;
      l := btrim(regexp_replace(l, '^\s*(\[x\]|☑|☒|✓|✔)\s+', '', 'i'));
    elsif l ~* '^\s*([-•*○◯☐□▪▫◦–—]|[0-9]+[.)]|\([0-9]+\)|\[ ?\]|\[x\]|☐|☑|☒|✓|✔|✗)\s+' then
      v_done := false;
      l := btrim(regexp_replace(l, '^\s*([-•*○◯☐□▪▫◦–—]|[0-9]+[.)]|\([0-9]+\)|\[ ?\]|\[x\]|☐|☑|☒|✓|✔|✗)\s+', '', 'i'));
    elsif v_items = '[]'::jsonb and v_title is null then
      v_title := orig;
      continue;
    else
      return null;
    end if;
    if l = '' then l := orig; end if;
    v_items := v_items || jsonb_build_object('text', l, 'done', v_done);
  end loop;
  if v_items = '[]'::jsonb then return null; end if;
  return jsonb_build_object('title', v_title, 'items', v_items);
end;
$$;

create or replace function public.migrate_notes_to_board_items()
returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  r record;
  new_item_id uuid;
  split jsonb;
  bare_lines text[];
  bare_n integer;
  bare_total integer;
  v_type text;
  v_body text;
  v_event_at timestamptz;
  n_notes integer := 0;
  n_lists integer := 0;
  n_entries integer := 0;
  n_assets integer := 0;
  j integer;
begin
  for r in select * from public.notes order by created_at, id loop
    v_type := 'note';
    v_body := r.text;
    v_event_at := null;
    split := null;
    bare_lines := null;

    if r.image_url is not null or r.kind = 'photo' then
      v_type := 'photo';
    else
      split := public._split_marked_list(r.text);
      if split is not null then
        v_type := 'list';
        v_body := split ->> 'title';
      elsif r.kind in ('list', 'grocery') then
        -- Explicit list that no longer parses: keep it as a title-only list.
        v_type := 'list';
        v_body := r.text;
      elsif r.kind = 'appointment' then
        v_type := 'date';
        if r.data ? 'eventAt' then
          v_event_at := (r.data ->> 'eventAt')::timestamptz;
        end if;
      elsif r.kind = 'note' then
        -- Bare-list fallback, mirroring the client: ≥3 short lines.
        select array_agg(t order by o), count(*), coalesce(sum(char_length(t)), 0)
          into bare_lines, bare_n, bare_total
          from (
            select btrim(v) as t, o
            from unnest(string_to_array(r.text, chr(10))) with ordinality as u(v, o)
          ) s
          where t <> '';
        if bare_n >= 3 and bare_total <= 140
           and not exists (select 1 from unnest(bare_lines) as x(t) where char_length(t) > 32) then
          v_type := 'list';
          v_body := bare_lines[1];
        end if;
      end if;
    end if;

    insert into public.board_items (
      board_id, type, body, event_at, expires_at,
      paper, layout,
      created_by, created_at, updated_by, updated_at,
      completed_by, completed_at, version
    ) values (
      r.board_id, v_type, v_body, v_event_at, r.expires_at,
      jsonb_build_object('color', r.color, 'rotation', r.rotation),
      case when coalesce((r.data ->> 'manual')::boolean, false)
        then jsonb_build_object('x', r.position_x, 'y', r.position_y, 'manual', true)
        else null end,
      r.author_id, r.created_at, r.author_id, r.updated_at,
      null, r.completed_at, 1
    ) returning id into new_item_id;

    if v_type = 'list' then
      n_lists := n_lists + 1;
      if split is not null then
        for j in 0 .. jsonb_array_length(split -> 'items') - 1 loop
          insert into public.list_entries (
            board_id, item_id, text, position, is_checked,
            created_by, created_at, updated_by, updated_at, version
          ) values (
            r.board_id, new_item_id,
            split -> 'items' -> j ->> 'text', j,
            (split -> 'items' -> j ->> 'done')::boolean,
            r.author_id, r.created_at, r.author_id, r.updated_at, 1
          );
          n_entries := n_entries + 1;
        end loop;
      elsif bare_lines is not null then
        for j in 2 .. array_length(bare_lines, 1) loop
          insert into public.list_entries (
            board_id, item_id, text, position, is_checked,
            created_by, created_at, updated_by, updated_at, version
          ) values (
            r.board_id, new_item_id, bare_lines[j], j - 1, false,
            r.author_id, r.created_at, r.author_id, r.updated_at, 1
          );
          n_entries := n_entries + 1;
        end loop;
      end if;
    else
      n_notes := n_notes + 1;
    end if;

    if r.image_url is not null then
      insert into public.item_assets (
        board_id, item_id, storage_path, uploaded_by, uploaded_at
      ) values (
        r.board_id, new_item_id, r.image_url, r.author_id, r.created_at
      );
      n_assets := n_assets + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'notes', n_notes, 'lists', n_lists, 'entries', n_entries, 'assets', n_assets
  );
end;
$$;

-- Run the backfill for any legacy rows present when this migration lands.
select public.migrate_notes_to_board_items();
