create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

drop policy "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select using (private.is_admin());

drop policy "asr_logs_admin" on public.asr_logs;
create policy "asr_logs_admin" on public.asr_logs
  for select using (private.is_admin());

drop policy "tts_logs_admin" on public.tts_logs;
create policy "tts_logs_admin" on public.tts_logs
  for select using (private.is_admin());

drop policy "admin_audit_log_admin_only" on public.admin_audit_log;
create policy "admin_audit_log_admin_only" on public.admin_audit_log
  for select using (private.is_admin());

drop policy "admin_audit_log_insert_admin" on public.admin_audit_log;
create policy "admin_audit_log_insert_admin" on public.admin_audit_log
  for insert with check (private.is_admin());

drop function if exists public.is_admin();
