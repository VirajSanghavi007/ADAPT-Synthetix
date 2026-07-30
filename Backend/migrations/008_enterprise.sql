-- Enterprise accounts: company name/role at signup, and a custom employee-ID
-- verification factor used in place of TOTP (checked in Backend/enterprise.py,
-- not via Supabase's native MFA — Supabase only supports totp/phone/webauthn).
alter table public.profiles
  add column if not exists company_name text,
  add column if not exists enterprise_role text,
  add column if not exists enterprise_employee_id_hash text;

-- authenticated users still can't set is_enterprise/tier themselves (grant list
-- from 005 already excludes them) — enterprise registration goes through the
-- backend's service-role-adjacent connection, same trust boundary as tier changes.
