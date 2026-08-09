



update public.profiles set role = 'admin'
  where id = (select id from auth.users where email = 'virajsanghavi000@gmail.com');

update public.profiles set tier = 'max'
  where id = (select id from auth.users where email = 'virajsanghavi5@gmail.com');

update public.profiles set tier = 'pro'
  where id = (select id from auth.users where email = 'virajsanghavi09@gmail.com');

update public.profiles set tier = 'free'
  where id = (select id from auth.users where email = 'virajsanghavi123@gmail.com');
