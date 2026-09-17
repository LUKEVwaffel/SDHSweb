-- ============================================================================
-- RIFLE ADMIN ACCOUNTS — S-6 admin visibility. rifle_admins has NO read
-- policy for anyone but the row's own owner (rifle_admins_read_self, see
-- rifle_admin_portal.sql) — S-6 previously had to query the SQL editor
-- directly to see who has a rifle-admin account. This adds ONE SECURITY
-- DEFINER function, gated to is_s6() inside the body, for the new Portal
-- Access DISPATCH tab (RifleAdminAccountsTab.jsx).
-- ============================================================================

create or replace function public.rifle_admin_status()
returns table (
  email                text,
  display_name         text,
  active                boolean,
  must_change_password  boolean,
  created_at            timestamptz
)
language sql stable security definer set search_path = public as $$
  select email, display_name, active, must_change_password, created_at
  from public.rifle_admins
  where public.is_s6()
  order by display_name
$$;

revoke all     on function public.rifle_admin_status() from public, anon;
grant  execute on function public.rifle_admin_status() to authenticated;

-- verify (as an S-6 session): one row per rifle-admin account.
--   select * from public.rifle_admin_status();
-- ============================================================================
