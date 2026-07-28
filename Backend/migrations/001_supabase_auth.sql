create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_select_admin" on public.profiles
  for select using (public.is_admin());

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create table public.asr_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  transcript text not null,
  duration_sec real,
  created_at timestamptz not null default now()
);

create table public.tts_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  input_text text not null,
  voice text not null,
  created_at timestamptz not null default now()
);

alter table public.asr_logs enable row level security;
alter table public.tts_logs enable row level security;

create policy "asr_logs_own" on public.asr_logs
  for select using (auth.uid() = user_id);

create policy "asr_logs_admin" on public.asr_logs
  for select using (public.is_admin());

create policy "asr_logs_insert_own" on public.asr_logs
  for insert with check (auth.uid() = user_id);

create policy "tts_logs_own" on public.tts_logs
  for select using (auth.uid() = user_id);

create policy "tts_logs_admin" on public.tts_logs
  for select using (public.is_admin());

create policy "tts_logs_insert_own" on public.tts_logs
  for insert with check (auth.uid() = user_id);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid not null references auth.users(id),
  action text not null,
  target_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

create policy "admin_audit_log_admin_only" on public.admin_audit_log
  for select using (public.is_admin());

create policy "admin_audit_log_insert_admin" on public.admin_audit_log
  for insert with check (public.is_admin());
