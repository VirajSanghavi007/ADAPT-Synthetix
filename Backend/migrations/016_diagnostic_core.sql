



create table if not exists public.priority_queue (
  id bigint generated always as identity primary key,
  asr_log_id bigint,
  priority_score real not null,
  domain_match_count integer not null default 0,
  error_type text not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'resolved')),
  created_at timestamptz not null default now()
);
create index if not exists idx_priority_queue_score on public.priority_queue(priority_score desc);
create index if not exists idx_priority_queue_status on public.priority_queue(status);

create table if not exists public.remedial_audio (
  id bigint generated always as identity primary key,
  transcription_id bigint,
  reference_phoneme text,
  hypothesis_phoneme text,
  carrier_text text not null,
  audio_path text not null,
  model_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_remedial_audio_transcription on public.remedial_audio(transcription_id);

create table if not exists public.phoneme_drift_events (
  id bigint generated always as identity primary key,
  model_id text not null,
  phoneme text not null,
  day date not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_phoneme_drift_model_phoneme_day on public.phoneme_drift_events(model_id, phoneme, day);

create table if not exists public.drift_trigger_events (
  id bigint generated always as identity primary key,
  model_id text not null,
  drifting_phonemes text not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_drift_trigger_model on public.drift_trigger_events(model_id, created_at desc);
