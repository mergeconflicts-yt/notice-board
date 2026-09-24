-- Audit history + write boundary.
--
-- board_events is append-only: clients can read their boards' trail but only
-- the triggers below (running as the table owner) may insert. The stamp
-- triggers fill in actor fields, timestamps and versions server-side, so the
-- Expo client must never send them. When auth.uid() is absent (migrations,
-- service-role jobs) rows pass through untouched.

create table if not exists public.board_events (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  actor_id uuid,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}',
  request_id uuid,
  created_at timestamptz not null default now()
);

alter table public.board_events enable row level security;

drop policy if exists "board_events_member_read" on public.board_events;
create policy "board_events_member_read" on public.board_events
  for select using (
    exists (
      select 1 from public.board_members bm
      where bm.board_id = board_events.board_id and bm.user_id = auth.uid()
    )
  );
-- No insert/update/delete policies: append-only, server-written.

-- ---------------------------------------------------------------------------
-- Stamp triggers: actor fields, timestamps, versions.
-- ---------------------------------------------------------------------------

create or replace function public._stamp_board_items()
returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then return NEW; end if;
  if TG_OP = 'INSERT' then
    NEW.created_by := auth.uid();
    NEW.created_at := now();
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
    NEW.version := 1;
  else
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
    NEW.version := coalesce(OLD.version, 0) + 1;
    if NEW.deleted_at is distinct from OLD.deleted_at then
      NEW.deleted_by := case when NEW.deleted_at is null then null else auth.uid() end;
    end if;
  end if;
  return NEW;
end;
$$;

create or replace function public._stamp_list_entries()
returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then return NEW; end if;
  if TG_OP = 'INSERT' then
    NEW.created_by := auth.uid();
    NEW.created_at := now();
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
    NEW.version := 1;
  else
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
    NEW.version := coalesce(OLD.version, 0) + 1;
    if NEW.is_checked is distinct from OLD.is_checked then
      NEW.checked_by := auth.uid();
      NEW.checked_at := now();
    end if;
    if NEW.deleted_at is distinct from OLD.deleted_at then
      NEW.deleted_by := case when NEW.deleted_at is null then null else auth.uid() end;
    end if;
  end if;
  return NEW;
end;
$$;

create or replace function public._stamp_item_assets()
returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then return NEW; end if;
  if TG_OP = 'INSERT' then
    NEW.uploaded_by := auth.uid();
    NEW.uploaded_at := now();
  end if;
  return NEW;
end;
$$;

create or replace function public._stamp_boards()
returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then return NEW; end if;
  if TG_OP = 'INSERT' then
    NEW.owner_id := auth.uid();
    NEW.created_by := auth.uid();
    NEW.created_at := now();
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
    NEW.version := 1;
  else
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.owner_id := OLD.owner_id;
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
    NEW.version := coalesce(OLD.version, 0) + 1;
    if NEW.deleted_at is distinct from OLD.deleted_at then
      NEW.deleted_by := case when NEW.deleted_at is null then null else auth.uid() end;
    end if;
  end if;
  return NEW;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit trigger: snapshot every mutation into board_events.
-- Soft delete/restore are derived from deleted_at transitions so the trail
-- can drive undo ("delete → restore").
-- ---------------------------------------------------------------------------

create or replace function public._audit_board_event()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_board uuid;
  v_entity text;
  v_action text;
  v_old jsonb;
  v_new jsonb;
begin
  v_entity := case TG_TABLE_NAME
    when 'boards' then 'board'
    when 'board_members' then 'member'
    when 'board_items' then 'item'
    when 'list_entries' then 'entry'
    when 'item_assets' then 'asset'
    else TG_TABLE_NAME
  end;

  if TG_OP = 'DELETE' then
    v_old := to_jsonb(OLD);
    v_board := coalesce((v_old ->> 'board_id'), (v_old ->> 'id'))::uuid;
    insert into public.board_events (board_id, actor_id, entity_type, entity_id, action, metadata)
    values (v_board, auth.uid(), v_entity, (v_old ->> 'id')::uuid, 'delete',
            jsonb_build_object('before', v_old));
    return OLD;
  end if;

  v_new := to_jsonb(NEW);
  v_board := coalesce((v_new ->> 'board_id'), (v_new ->> 'id'))::uuid;
  if TG_OP = 'INSERT' then
    v_action := 'insert';
    insert into public.board_events (board_id, actor_id, entity_type, entity_id, action, metadata)
    values (v_board, auth.uid(), v_entity, (v_new ->> 'id')::uuid, v_action,
            jsonb_build_object('after', v_new));
  else
    v_old := to_jsonb(OLD);
    if (v_old ->> 'deleted_at') is null and (v_new ->> 'deleted_at') is not null then
      v_action := 'delete';
    elsif (v_old ->> 'deleted_at') is not null and (v_new ->> 'deleted_at') is null then
      v_action := 'restore';
    else
      v_action := 'update';
    end if;
    insert into public.board_events (board_id, actor_id, entity_type, entity_id, action, metadata)
    values (v_board, auth.uid(), v_entity, (v_new ->> 'id')::uuid, v_action,
            jsonb_build_object('before', v_old, 'after', v_new));
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_stamp_boards on public.boards;
create trigger trg_stamp_boards
  before insert or update on public.boards
  for each row execute function public._stamp_boards();

drop trigger if exists trg_stamp_board_items on public.board_items;
create trigger trg_stamp_board_items
  before insert or update on public.board_items
  for each row execute function public._stamp_board_items();

drop trigger if exists trg_stamp_list_entries on public.list_entries;
create trigger trg_stamp_list_entries
  before insert or update on public.list_entries
  for each row execute function public._stamp_list_entries();

drop trigger if exists trg_stamp_item_assets on public.item_assets;
create trigger trg_stamp_item_assets
  before insert on public.item_assets
  for each row execute function public._stamp_item_assets();

drop trigger if exists trg_audit_boards on public.boards;
create trigger trg_audit_boards
  after insert or update or delete on public.boards
  for each row execute function public._audit_board_event();

drop trigger if exists trg_audit_board_members on public.board_members;
create trigger trg_audit_board_members
  after insert or update or delete on public.board_members
  for each row execute function public._audit_board_event();

drop trigger if exists trg_audit_board_items on public.board_items;
create trigger trg_audit_board_items
  after insert or update or delete on public.board_items
  for each row execute function public._audit_board_event();

drop trigger if exists trg_audit_list_entries on public.list_entries;
create trigger trg_audit_list_entries
  after insert or update or delete on public.list_entries
  for each row execute function public._audit_board_event();

drop trigger if exists trg_audit_item_assets on public.item_assets;
create trigger trg_audit_item_assets
  after insert or update or delete on public.item_assets
  for each row execute function public._audit_board_event();

-- item_assets rides the realtime publication too, so a photo appears for
-- collaborators the moment its asset row lands (not just on the next item
-- event).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'item_assets'
  ) then
    alter publication supabase_realtime add table public.item_assets;
  end if;
end
$$;
