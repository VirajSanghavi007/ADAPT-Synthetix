alter table public.request_latency
  add column if not exists cold boolean not null default false;
