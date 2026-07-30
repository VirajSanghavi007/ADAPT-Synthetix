-- Track which model produced each transcription/synthesis, for tier reporting and
-- the Error Analysis / usage dashboards.
alter table public.asr_logs add column if not exists model_id text;
alter table public.tts_logs add column if not exists model_id text;
