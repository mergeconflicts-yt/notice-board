-- The legacy invite_code column stays NOT NULL + unique for old clients, but
-- the new model issues invites through board_invites instead. Give new rows
-- a dummy server-generated value so v2 writes only send { name }.
alter table public.boards
  alter column invite_code
  set default ('v2-' || replace(gen_random_uuid()::text, '-', ''));
