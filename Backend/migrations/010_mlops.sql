create table if not exists public.eval_metrics (
  id bigint generated always as identity primary key,
  asr_log_id bigint,
  model_id text not null,
  wer real not null,
  cer real not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_eval_metrics_model on public.eval_metrics(model_id, created_at);

create table if not exists public.model_registry (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('asr', 'tts')),
  tier text not null check (tier in ('free', 'pro', 'max', 'enterprise')),
  model_id text not null,
  version_tag text not null default 'base',
  is_live boolean not null default true,
  notes text,
  promoted_at timestamptz not null default now()
);



insert into public.model_registry (kind, tier, model_id, version_tag) values
  ('asr', 'free', 'distil-whisper/distil-large-v3', 'base'),
  ('asr', 'pro', 'openai/whisper-large-v3-turbo', 'base'),
  ('asr', 'max', 'nvidia/parakeet-tdt-0.6b-v2', 'base'),
  ('asr', 'enterprise', 'nvidia/parakeet-tdt-0.6b-v2', 'base'),
  ('tts', 'free', 'kokoro', 'base'),
  ('tts', 'pro', 'suno/bark', 'base'),
  ('tts', 'max', 'FunAudioLLM/CosyVoice2-0.5B', 'base'),
  ('tts', 'enterprise', 'FunAudioLLM/CosyVoice2-0.5B', 'base');
