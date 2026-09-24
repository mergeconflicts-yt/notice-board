-- Board name/colour changes should reach open board screens live. The
-- publication originally carried only items/list_entries/board_members
-- (docs/plan.md §4); board metadata is member-scoped, so `boards` is safe to
-- add (RLS still applies to the subscriber).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'boards'
  ) then
    alter publication supabase_realtime add table public.boards;
  end if;
end
$$;
