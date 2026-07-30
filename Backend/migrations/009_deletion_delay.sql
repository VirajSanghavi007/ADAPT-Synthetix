alter table public.account_deletion_requests
  add column if not exists confirmed_at timestamptz,
  add column if not exists executed boolean not null default false;
