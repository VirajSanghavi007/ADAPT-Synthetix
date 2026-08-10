update public.profiles set enterprise_domain = 'non_normative' where enterprise_domain = 'medical';

alter table public.profiles
  drop constraint if exists profiles_enterprise_domain_check;

alter table public.profiles
  add constraint profiles_enterprise_domain_check
    check (enterprise_domain is null or enterprise_domain in ('non_normative', 'children', 'elderly'));
