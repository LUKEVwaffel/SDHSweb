-- ============================================================================
-- EMAIL REVIEW PORTAL — re-arm the forced-password-change gate for the SAI's
-- account. Run in the Supabase SQL editor. Idempotent.
--
-- ROOT CAUSE: email_reviewer_first_login.sql permanently backfilled the 3
-- original reviewer rows (thrasher_michael@hcde.org, kazminski_jay@hcde.org,
-- hodges_tim@hcde.org) to must_change_password = false, on the one-time
-- 2026-07-22 assumption that all 3 already had real, self-chosen passwords.
-- That assumption did not hold for thrasher_michael@hcde.org (Chief/SAI) —
-- logging in with a temp password did not trigger the change-password screen,
-- because the flag was already false and nothing in this codebase ever flips
-- it back to true after the one-time backfill. There is no in-app reviewer
-- password-reset flow; reviewer Supabase Auth passwords are set/reset
-- manually in the Supabase dashboard, outside any code path that touches this
-- column.
--
-- Server-side enforcement itself is NOT the bug — is_reviewer() (RLS) and
-- submit-review-decision both correctly gate on must_change_password already.
-- This is a data fix, not a logic fix.
-- ============================================================================

update public.email_reviewers set must_change_password = true
  where email = 'thrasher_michael@hcde.org';

-- verify:
--   select email, must_change_password from public.email_reviewers
--     where email = 'thrasher_michael@hcde.org';   -- expect true


-- ── SECTION 2 — auto re-arm the gate on any password change, not just this
-- one-time fix ────────────────────────────────────────────────────────────
-- SECURITY FIX (security-reviewer finding, MEDIUM): a manual runbook step
-- ("remember to flip this flag when you reset a password") is the exact
-- failure mode that caused this incident — a human forgot, or the step
-- didn't exist yet. Replacing it with a trigger on auth.users removes the
-- human step entirely: ANY change to a reviewer's Supabase Auth password
-- (dashboard reset, "send password reset" email, future self-service flow)
-- re-arms must_change_password automatically, with no code path required to
-- know about it.
--
-- Safe for non-reviewers too: the UPDATE's WHERE clause only ever matches a
-- row if new.email exists in email_reviewers, so this is a silent no-op for
-- every admin_roles account.
--
-- Ordering with the existing first-login flow (ForcePasswordChange.jsx) is
-- still correct: the client calls auth.updateUser({password}) — which fires
-- this trigger and sets the flag true — THEN separately invokes
-- complete-first-login, which clears it back to false via the service-role
-- client. Two sequential round trips, but always in that order, so the final
-- state is right.
create or replace function public.reviewer_password_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.email_reviewers
      set must_change_password = true
      where lower(email) = lower(new.email);
  end if;
  return new;
end;
$$;

drop trigger if exists on_reviewer_password_changed on auth.users;
create trigger on_reviewer_password_changed
  after update of encrypted_password on auth.users
  for each row execute function public.reviewer_password_changed();

-- verify:
--   select tgname from pg_trigger where tgname = 'on_reviewer_password_changed';


-- ============================================================================
-- RUNBOOK (fallback only, now automatic via the trigger above) — if the
-- trigger is ever missing/broken/skipped in some environment, the manual step
-- is the same one-liner used at the top of this file:
--
--   update public.email_reviewers set must_change_password = true
--     where email = '<reviewer email>';
-- ============================================================================
