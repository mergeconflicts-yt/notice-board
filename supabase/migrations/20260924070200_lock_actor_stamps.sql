-- Actor forgery lockdown: a member could previously make it look like
-- someone else posted, ticked, completed, or deleted something.
--
-- The stamp triggers only overwrote WHO-columns on the transition that
-- implies the action (e.g. completed_by when completed_at flips), but left
-- client-supplied values untouched otherwise — and list_entries never
-- stamped checked_by on insert at all, while item_assets had no update
-- trigger, leaving uploaded_by freely rewritable.
--
-- From here on every actor WHO-column is server-decided, always:
--   * on the implying transition it is stamped from auth.uid() (or cleared
--     when the flag is cleared);
--   * otherwise it is pinned to the old value, so forged values never stick;
--   * on insert it is stamped when the flag arrives set, else nulled.
-- Clients already follow this contract (they send only the flags —
-- completed_at / is_checked — and read the attribution back), so no client
-- change is needed. Service-role / migration writes (no auth.uid()) still
-- pass through untouched.

-- ---------------------------------------------------------------------------
-- board_items: pin completed_by / deleted_by when their flags don't move.
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
    if NEW.completed_at is not null then
      NEW.completed_by := auth.uid();
    else
      NEW.completed_by := null;
    end if;
  else
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
    NEW.version := coalesce(OLD.version, 0) + 1;
    if NEW.deleted_at is distinct from OLD.deleted_at then
      NEW.deleted_by := case when NEW.deleted_at is null then null else auth.uid() end;
    else
      NEW.deleted_by := OLD.deleted_by;
    end if;
    if NEW.completed_at is distinct from OLD.completed_at then
      NEW.completed_by := case when NEW.completed_at is null then null else auth.uid() end;
    else
      NEW.completed_by := OLD.completed_by;
    end if;
  end if;
  return NEW;
end;
$$;

-- ---------------------------------------------------------------------------
-- list_entries: stamp checked_by on insert; pin checked_by / deleted_by when
-- their flags don't move.
-- ---------------------------------------------------------------------------

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
    if NEW.is_checked then
      NEW.checked_by := auth.uid();
      NEW.checked_at := now();
    else
      NEW.checked_by := null;
      NEW.checked_at := null;
    end if;
  else
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
    NEW.version := coalesce(OLD.version, 0) + 1;
    if NEW.is_checked is distinct from OLD.is_checked then
      NEW.checked_by := auth.uid();
      NEW.checked_at := now();
    else
      NEW.checked_by := OLD.checked_by;
      NEW.checked_at := OLD.checked_at;
    end if;
    if NEW.deleted_at is distinct from OLD.deleted_at then
      NEW.deleted_by := case when NEW.deleted_at is null then null else auth.uid() end;
    else
      NEW.deleted_by := OLD.deleted_by;
    end if;
  end if;
  return NEW;
end;
$$;

-- ---------------------------------------------------------------------------
-- item_assets: uploader is immutable — stamped on insert, pinned on update.
-- ---------------------------------------------------------------------------

create or replace function public._stamp_item_assets()
returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then return NEW; end if;
  if TG_OP = 'INSERT' then
    NEW.uploaded_by := auth.uid();
    NEW.uploaded_at := now();
  else
    NEW.uploaded_by := OLD.uploaded_by;
    NEW.uploaded_at := OLD.uploaded_at;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_stamp_item_assets on public.item_assets;
create trigger trg_stamp_item_assets
  before insert or update on public.item_assets
  for each row execute function public._stamp_item_assets();

-- ---------------------------------------------------------------------------
-- boards: pin deleted_by when the soft-delete flag doesn't move (created_by
-- and owner_id were already pinned; updated_by is always restamped).
-- ---------------------------------------------------------------------------

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
    else
      NEW.deleted_by := OLD.deleted_by;
    end if;
  end if;
  return NEW;
end;
$$;
