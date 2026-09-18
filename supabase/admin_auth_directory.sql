-- ============================================================================
-- AUTH ACCOUNT DIRECTORY — S-6 visibility into raw Supabase Auth users, with
-- a display name and every portal population's active state pulled in by
-- email, so the AUTH tab (AuthAccountsTab.jsx) can show "who is this" and
-- "what do they currently have" without four separate queries. Read-only —
-- creating/resetting/deleting a login still goes through the Admin API
-- (edge functions), which is the only supported way to touch a real
-- encrypted password. Same is_s6()-gated SECURITY DEFINER pattern as
-- rifle_admin_status() / ball_dress_staff_status().
--
-- ball_dress_staff has ONE row per email (email is its primary key — a
-- person is either female_dress or male_guest_attire, never both at once),
-- so a single left join is enough; no per-role split needed here.
--
-- reviewer_active reflects the email_reviewers row existing/active AT ALL —
-- the three can_* columns (email_reviewer_capability_split.sql) are the real
-- per-surface grants; reviewer_active alone does not mean the person can do
-- anything until at least one of the three is also true.
--
-- admin_roles (DISPATCH access) is intentionally included as READ-ONLY info
-- (admin_role/admin_must_change_password) — the AUTH tab's revoke/delete
-- actions do not touch it. DISPATCH access stays the more guarded population
-- managed from the People panel, same separation every other file in this
-- system already keeps.
-- ============================================================================

create or replace function public.admin_auth_directory()
returns table (
  id                      uuid,
  email                   text,
  display_name            text,
  created_at              timestamptz,
  email_confirmed_at      timestamptz,
  last_sign_in_at         timestamptz,
  admin_role              text,
  admin_must_change_password boolean,
  reviewer_active         boolean,
  reviewer_must_change_password boolean,
  can_email_review        boolean,
  can_ball_ops            boolean,
  can_rifle_signups       boolean,
  dress_role              text,
  dress_active            boolean,
  rifle_admin_active      boolean,
  rifle_admin_must_change_password boolean
)
language sql stable security definer set search_path = public as $$
  select
    u.id, u.email,
    coalesce(ar.display_name, er.display_name, ra.display_name, bds.name) as display_name,
    u.created_at, u.email_confirmed_at, u.last_sign_in_at,
    ar.role, ar.must_change_password,
    er.active, er.must_change_password,
    er.can_email_review, er.can_ball_ops, er.can_rifle_signups,
    bds.role, bds.active,
    ra.active, ra.must_change_password
  from auth.users u
  left join public.admin_roles ar      on lower(ar.email) = lower(u.email)
  left join public.email_reviewers er  on lower(er.email) = lower(u.email)
  left join public.rifle_admins ra     on lower(ra.email) = lower(u.email)
  left join public.ball_dress_staff bds on lower(bds.email) = lower(u.email)
  where public.is_s6()
  order by u.created_at desc
$$;

revoke all     on function public.admin_auth_directory() from public, anon;
grant  execute on function public.admin_auth_directory() to authenticated;

-- ============================================================================
-- VERIFY (as an S-6 session): one row per Supabase Auth user, with whichever
-- portal columns apply populated and the rest null.
--   select * from public.admin_auth_directory();
-- ============================================================================
