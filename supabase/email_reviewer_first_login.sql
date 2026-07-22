-- ============================================================================
-- ⚠ DO NOT RE-RUN THIS FILE. SECTION 1's backfill below is a ONE-TIME
-- correction dated 2026-07-22 — it unconditionally sets must_change_password
-- = false for the 3 named reviewer emails. Re-applying it (e.g. during a
-- fresh-environment setup that replays every supabase/*.sql file in order)
-- will silently re-disable the forced-password-change gate again, the exact
-- bug fixed in email_reviewer_password_gate_fix.sql. That file's SECTION 2
-- trigger (on_reviewer_password_changed) now keeps the flag correct going
-- forward without needing this file to run again.
--
-- EMAIL REVIEW PORTAL — forced password change on first login. Run in the
-- Supabase SQL editor. Idempotent. Depends on email_review.sql (email_reviewers).
--
-- WHAT THIS ADDS:
--   • email_reviewers.must_change_password — true means the reviewer is still
--     on the dashboard-created temp password and must set their own before
--     they can do anything else in the portal. Cleared server-side (never by
--     the client) by the complete-first-login edge function once
--     supabase.auth.updateUser({ password }) has succeeded.
--
-- ⚠ CRITICAL: the 3 reviewers seeded in email_review.sql already have real,
-- self-chosen passwords in active use (confirmed live 2026-07-22, per the
-- portal's password-based login design). Defaulting this column to true would
-- force-wall them into a change-password screen on their NEXT login for no
-- reason. This script explicitly backfills those 3 to false in the same
-- migration that adds the column — only NEW reviewer rows created after this
-- point default to true (dashboard-created temp password → real first-login
-- gate). Do not run the column ADD without the backfill UPDATE below.
-- ============================================================================

-- ── SECTION 1 — the column + safe backfill ──────────────────────────────────
alter table public.email_reviewers
  add column if not exists must_change_password boolean not null default true;

-- Backfill: the 3 already-live reviewers keep using their existing password,
-- no gate on next login.
update public.email_reviewers set must_change_password = false
  where email in (
    'thrasher_michael@hcde.org',
    'kazminski_jay@hcde.org',
    'hodges_tim@hcde.org'
  );

-- ── SECTION 2 — enforce the gate at the RLS layer, not just in React state ──
-- SECURITY FIX (security-reviewer finding, HIGH): the original version of this
-- feature only checked must_change_password in the client (ReviewPortal.jsx's
-- phase router). That's a UI nicety, not a control — a session minted from a
-- leaked/guessed temp password could call the reviewer edge functions or the
-- PostgREST API directly and get full reviewer capability (read every pending
-- draft, approve/deny real outgoing DISPATCH email) with the gate never
-- engaging. is_reviewer() backs every reviewer-facing RLS policy
-- (email_messages_read_reviewer, email_messages_read_reviewer_history), so
-- redefining it here to also require `not must_change_password` closes the
-- direct-API-bypass path in one place. This MUST run after SECTION 1 above —
-- the column it references doesn't exist until then.
create or replace function public.is_reviewer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.email_reviewers
    where lower(email) = lower(auth.jwt() ->> 'email') and active and not must_change_password
  );
$$;

-- ── verify after running ─────────────────────────────────────────────────────
--   -- confirm the 3 live reviewers are NOT gated:
--   select email, must_change_password from public.email_reviewers;
--   -- expect all 3 existing rows = false. Any FUTURE reviewer row you add
--   -- (dashboard-created, temp password) will default to true automatically.
--   -- confirm is_reviewer() picked up the new clause (run as a reviewer still
--   -- on must_change_password=true — expect false):
--   select public.is_reviewer();
-- ============================================================================
