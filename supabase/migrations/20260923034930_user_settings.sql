-- Per-user preferences. One row per profile, managed by its owner.

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  last_board_id uuid references public.boards (id) on delete set null,
  locale text,
  timezone text,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  reduce_motion boolean not null default false
);

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_owner_read" on public.user_settings;
create policy "user_settings_owner_read" on public.user_settings
  for select using (user_id = auth.uid());

drop policy if exists "user_settings_owner_write" on public.user_settings;
create policy "user_settings_owner_write" on public.user_settings
  for insert with check (user_id = auth.uid());

drop policy if exists "user_settings_owner_update" on public.user_settings;
create policy "user_settings_owner_update" on public.user_settings
  for update using (user_id = auth.uid());
