-- update public.profiles
-- set role = 'admin', approved = true
-- where id = (select id from auth.users where email = 'brosammy1et2@gmail.com');

update public.profiles
set approved = true
where id = (select id from auth.users where email = 'docteur@exemple.org');