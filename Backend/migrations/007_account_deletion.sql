create table if not exists public.account_deletion_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.account_deletion_requests enable row level security;


