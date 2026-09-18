-- ============================================================================
-- AUTH ACCOUNT DIRECTORY — S-6 visibility into raw Supabase Auth users.
-- Every provisioning flow on this site (reviewer, rifle admin, dress/attire,
-- DISPATCH admin_roles) ultimately needs a Supabase Auth user to exist before
-- a portal-specific row means anything — until now that was a manual
-- Dashboard → Authentication → Users step. This is ONE SECURITY DEFINER
-- function, gated to is_s6() inside the body (same pattern as
-- rifle_admin_status() / ball_dress_staff_status()), reading auth.users
-- directly — for the new Portal Access "AUTH" tab (AuthAccountsTab.jsx).
-- Read-only: creating a user still goes through the Admin API (edge function
-- admin-create-auth-user), which is the only supported way to set a real
-- encrypted password — this function never touches auth.users, only reads it.
-- ============================================================================

create or replace function public.admin_auth_directory()
returns table (
  id                 uuid,
  email              text,
  created_at         timestamptz,
  email_confirmed_at timestamptz,
  last_sign_in_at    timestamptz
)
language sql stable security definer set search_path = public as $$
  select u.id, u.email, u.created_at, u.email_confirmed_at, u.last_sign_in_at
  from auth.users u
  where public.is_s6()
  order by u.created_at desc
$$;

revoke all     on function public.admin_auth_directory() from public, anon;
grant  execute on function public.admin_auth_directory() to authenticated;

-- ============================================================================
-- VERIFY (as an S-6 session): one row per Supabase Auth user.
--   select * from public.admin_auth_directory();
-- ============================================================================
