-- Fresh disposable Postgres cluster only.
create role anon;create role authenticated;create role service_role;
create schema auth;
create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$;
create function public.is_admin() returns boolean language sql stable as $$select coalesce(current_setting('test.admin',true),'')='yes'$$;
