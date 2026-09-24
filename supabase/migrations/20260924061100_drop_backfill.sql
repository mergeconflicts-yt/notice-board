-- The legacy backfill has served its purpose. Revoke public execution and
-- remove it so it can never duplicate content. (_split_marked_list stays:
-- it is immutable, reads no tables, and is useful for future imports.)
revoke execute on function public.migrate_notes_to_board_items() from anon, authenticated, public;
drop function public.migrate_notes_to_board_items();
