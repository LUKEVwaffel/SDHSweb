-- ============================================================================
-- UNIFIED PORTAL HUB — /portal. One email-only login surfaces every
-- non-DISPATCH staff portal a person has access to, instead of them hunting
-- down (or bookmarking) a different /ball/dress, /ball/attire, /review, or
-- /rifle/portal login screen. DISPATCH (S-6/S-5/BC, admin_roles) is
-- deliberately NOT included here — it stays its own separate, more guarded
-- surface (PIN/password/passkey via /admin), not reachable from this hub.
--
-- my_portals() is read-only and additive: it just asks the same is_*()
-- functions each portal's own RLS already trusts (is_reviewer(),
-- is_ball_dress(), is_ball_attire()), so there is no new authorization
-- surface here, no new source of truth, and no way for this hub to disagree
-- with the portal it links to.
--
-- rifle_portal is the ONE exception, and deliberately does NOT use
-- is_rifle_admin() here: that gate also requires `not must_change_password`
-- (see rifle_admin_portal.sql), which is correct for RLS on the rifle data
-- tables but wrong for this listing — a freshly-provisioned account (active,
-- but still on its temp password) would never appear here, and since the
-- old per-portal login screens are gone, that account would have NO path to
-- ever complete first login. Listing it off raw `active` instead, and
-- labeling it distinctly, means clicking through still lands on
-- RiflePortal.jsx's own force-password screen (it checks the session
-- directly, not this function) — is_rifle_admin() keeps gating the actual
-- data once that's done.
-- ============================================================================

create or replace function public.my_portals()
returns table (key text, label text, description text, path text)
language sql stable security definer set search_path = public as $$
  select 'review'::text, 'Reviewer Portal'::text,
         'Email review, Ball payments, Rifle signups'::text, '/review'::text
  where public.is_reviewer()
  union all
  select 'ball_dress', 'Ball — Dress Approval',
         'Approve female cadet & guest attire photos', '/ball/dress'
  where public.is_ball_dress()
  union all
  select 'ball_attire', 'Ball — Male Guest Attire',
         'Approve male guest attire photos', '/ball/attire'
  where public.is_ball_attire()
  union all
  select 'rifle_portal'::text,
         case when ra.must_change_password then 'Rifle Team Admin — finish setup'
              else 'Rifle Team Admin' end,
         case when ra.must_change_password then 'Sign in to set your password and finish account setup'
              else 'Manage the rifle team roster' end,
         '/rifle/portal'::text
  from public.rifle_admins ra
  where lower(ra.email) = lower(auth.jwt() ->> 'email') and ra.active;
$$;

revoke all     on function public.my_portals() from public, anon;
grant  execute on function public.my_portals() to authenticated;

-- verify (as a signed-in reviewer/dress/attire/rifle-admin session):
--   select * from public.my_portals();
-- ============================================================================
