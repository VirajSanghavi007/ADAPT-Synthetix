





alter table public.priority_queue
  add column if not exists human_importance integer,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid;

create table if not exists public.noise_feature_samples (
  id bigint generated always as identity primary key,
  spectral_centroid real not null,
  spectral_bandwidth real not null,
  spectral_rolloff real not null,
  zero_crossing_rate real not null,
  rms_energy real not null,
  mfcc_variance real not null,
  tempo real not null,
  harmonic_ratio real not null,
  heuristic_label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.error_diagnosis_samples (
  id bigint generated always as identity primary key,
  confidence real,
  cer real,
  noise_category text not null,
  error_type text not null,
  created_at timestamptz not null default now()
);
