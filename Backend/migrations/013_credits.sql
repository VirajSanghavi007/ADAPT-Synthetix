









alter table public.profiles
  add column if not exists credits_remaining integer not null default 50,
  add column if not exists credits_total integer not null default 50,
  add column if not exists credits_cycle_started_at timestamptz not null default now();



