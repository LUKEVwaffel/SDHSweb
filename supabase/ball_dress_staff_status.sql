-- ============================================================================
-- ATTIRE STAFF — S-6 admin visibility of dress/attire account state. Run in the
-- Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent, re-runnable.
-- Depends on: ball_signup.sql (ball_dress_staff), ball_finalize.sql (role
-- column), admin_roles.sql (is_s6).
--
-- ball_dress_staff is service-role ONLY (no client policies, same posture as
-- reviewer_credentials) — S-6 provisions PINs through ball-dress-set-pin but
-- otherwise cannot see who has an account. This adds ONE SECURITY DEFINER
-- function, gated to is_s6() inside the body, returning name / role / active /
-- has-pin / locked-until per account. No hash, no fail counter.
-- ============================================================================

create or replace function public.ball_dress_staff_status()
returns table (
  email            text,
  name             text,
  role             text,
  active           boolean,
  has_pin          boolean,
  pin_locked_until timestamptz,
  updated_at       timestamptz
)
language sql stable security definer set search_path = public as $$
  select s.email,
         s.name,
         s.role,
         s.active,
         (s.pin_hash is not null)                       as has_pin,
         case when s.pin_locked_until > now()
              then s.pin_locked_until end               as pin_locked_until,
         s.updated_at
  from public.ball_dress_staff s
  where public.is_s6()
  order by s.role, s.name
$$;

revoke all     on function public.ball_dress_staff_status() from public, anon;
grant  execute on function public.ball_dress_staff_status() to authenticated;

-- verify (as an S-6 session): one row per attire account, has_pin true/false.
--   select * from public.ball_dress_staff_status();
-- ============================================================================
