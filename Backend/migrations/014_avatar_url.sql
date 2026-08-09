



alter table public.profiles
  add column if not exists avatar_url text;

grant update (avatar_url) on public.profiles to authenticated;
