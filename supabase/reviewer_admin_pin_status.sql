-- ============================================================================
-- REVIEW PORTAL — S-6 admin visibility of reviewer PIN state. Run in the
-- Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent, re-runnable.
-- Depends on: email_review.sql (email_reviewers, is_reviewer), reviewer_pin.sql
-- (reviewer_credentials), admin_roles.sql (is_s6).
--
-- WHY THIS EXISTS: S-6 already manages the reviewer roster directly —
-- email_reviewers has the email_reviewers_admin_all policy (FOR ALL to
-- authenticated USING is_s6()), so the new "REVIEW PORTAL ACCOUNTS" tab in
-- BallPanel reads/writes that table with a plain PostgREST call. But the PIN
-- hash + lockout counters live in reviewer_credentials, which is service-role
-- ONLY (zero client policies, same posture as account_credentials). Without a
-- helper, S-6 cannot see which reviewers have a PIN set or whether one is
-- locked out. reviewer_has_pin() exists but is self-only (reads the caller's
-- own JWT email), so it is useless to S-6 looking at other people.
--
-- This adds ONE SECURITY DEFINER function that returns has-pin / locked-until
-- for EVERY reviewer, gated to is_s6() inside the body. It exposes no hash and
-- no fail counter — only the two booleans/timestamps the admin UI needs.
-- ============================================================================

create or replace function public.reviewer_pin_status()
returns table (
  email               text,
  display_name        text,
  title               text,
  active              boolean,
  must_change_password boolean,
  has_pin             boolean,
  pin_locked_until    timestamptz
)
language sql stable security definer set search_path = public as $$
  select r.email,
         r.display_name,
         r.title,
         r.active,
         r.must_change_password,
         (rc.pin_hash is not null)                      as has_pin,
         case when rc.pin_locked_until > now()
              then rc.pin_locked_until end              as pin_locked_until
  from public.email_reviewers r
  left join public.reviewer_credentials rc on rc.email = r.email
  where public.is_s6()
  order by r.display_name
$$;

-- SECURITY DEFINER + CREATE implicitly grants EXECUTE to PUBLIC — revoke it,
-- then hand it back to authenticated only. The is_s6() gate inside the body is
-- the real control (a non-s6 authenticated caller gets 0 rows), but keeping
-- anon off the function entirely is defense in depth.
revoke all     on function public.reviewer_pin_status() from public, anon;
grant  execute on function public.reviewer_pin_status() to authenticated;

-- ── verify after running ────────────────────────────────────────────────────
--   -- as an S-6 session: one row per reviewer, has_pin true/false, no hash.
--   select * from public.reviewer_pin_status();
--   -- as a non-s6 authenticated session: 0 rows.
--   select has_function_privilege('anon','public.reviewer_pin_status()','execute'); -- false
-- ============================================================================
