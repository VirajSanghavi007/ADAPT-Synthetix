



alter table public.profiles
  add column if not exists tier text not null default 'free'
    check (tier in ('free', 'pro', 'max', 'enterprise')),
  add column if not exists username text unique,
  add column if not exists avatar_id smallint check (avatar_id between 1 and 10);


grant update (display_name, username, avatar_id) on public.profiles to authenticated;



alter table public.profiles
  add column if not exists is_enterprise boolean not null default false;


update public.profiles set tier = 'max'
  where id = (select id from auth.users where email = 'virajsanghavi000@gmail.com');
update public.profiles set tier = 'pro'
  where id = (select id from auth.users where email = 'virajsanghavi5@gmail.com');
update public.profiles set tier = 'free'
  where id = (select id from auth.users where email = 'virajsanghavi123@gmail.com');
