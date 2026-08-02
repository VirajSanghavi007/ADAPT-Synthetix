create table if not exists public.request_latency (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('asr', 'tts')),
  model_id text not null,
  tier text not null,
  latency_ms real not null,
  success boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_request_latency_model on public.request_latency(model_id, created_at);
