alter table public.asr_logs
  add column if not exists wpr real;

alter table public.eval_metrics
  add column if not exists her real;

alter table public.error_diagnosis_samples
  add column if not exists her real,
  add column if not exists wpr real;
