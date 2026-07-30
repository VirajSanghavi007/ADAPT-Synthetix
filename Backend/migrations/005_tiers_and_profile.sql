-- Subscription tiers, username, and avatar selection on profiles.
-- Tier is intentionally NOT grantable to the authenticated role (see 002's
-- role-escalation fix) — only display_name/username/avatar_id are user-editable.

alter table public.profiles
  add column if not exists tier text not null default 'free'
    check (tier in ('free', 'pro', 'max', 'enterprise')),
  add column if not exists username text unique,
  add column if not exists avatar_id smallint check (avatar_id between 1 and 10);

-- authenticated users may edit their own display name, username, avatar — never tier/role
grant update (display_name, username, avatar_id) on public.profiles to authenticated;

-- Enterprise accounts (hospitals etc.) are free but flagged separately from the paid tiers,
-- so billing/reporting can tell "enterprise free" apart from "individual free".
alter table public.profiles
  add column if not exists is_enterprise boolean not null default false;

-- Test accounts for this project, seeded by email.
update public.profiles set tier = 'max'
  where id = (select id from auth.users where email = 'virajsanghavi000@gmail.com');
update public.profiles set tier = 'pro'
  where id = (select id from auth.users where email = 'virajsanghavi5@gmail.com');
update public.profiles set tier = 'free'
  where id = (select id from auth.users where email = 'virajsanghavi123@gmail.com');
