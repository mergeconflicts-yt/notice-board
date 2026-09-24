-- Stamp who completed an item, alongside the existing actor stamping.
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
    end if;
  else
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
    NEW.version := coalesce(OLD.version, 0) + 1;
    if NEW.deleted_at is distinct from OLD.deleted_at then
      NEW.deleted_by := case when NEW.deleted_at is null then null else auth.uid() end;
    end if;
    if NEW.completed_at is distinct from OLD.completed_at then
      NEW.completed_by := case when NEW.completed_at is null then null else auth.uid() end;
    end if;
  end if;
  return NEW;
end;
$$;
