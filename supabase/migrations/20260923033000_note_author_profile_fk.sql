-- Let PostgREST resolve the `profiles(*)` embeds the app uses on notes and
-- board_members. Every profile id is an auth user id, so these constraints are
-- consistent with the existing auth.users references.
alter table public.notes
  add constraint notes_author_id_profiles_fkey
  foreign key (author_id) references public.profiles (id) on delete cascade;

alter table public.board_members
  add constraint board_members_user_id_profiles_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;
