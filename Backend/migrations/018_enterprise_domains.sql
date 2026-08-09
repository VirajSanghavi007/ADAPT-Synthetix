



alter table public.profiles
  add column if not exists enterprise_domain text
    check (enterprise_domain is null or enterprise_domain in ('medical', 'children', 'elderly'));
