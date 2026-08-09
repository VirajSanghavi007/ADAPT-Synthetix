


alter table public.profiles
  add column if not exists company_name text,
  add column if not exists enterprise_role text,
  add column if not exists enterprise_employee_id_hash text;




