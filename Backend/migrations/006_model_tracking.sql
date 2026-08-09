

alter table public.asr_logs add column if not exists model_id text;
alter table public.tts_logs add column if not exists model_id text;
