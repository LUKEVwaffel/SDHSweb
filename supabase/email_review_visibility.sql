-- ============================================================================
-- EMAIL REVIEW PORTAL — widen reviewer visibility to APPROVED + SENT. Run in
-- the Supabase SQL editor. Idempotent. Depends on email_review_history.sql
-- (email_messages_read_reviewer_sent, which this replaces).
--
-- GAP THIS CLOSES: email_review_history.sql gave every active reviewer read
-- access to ALL 'sent' messages, but nothing covered 'approved' — a message
-- that cleared review but hasn't gone out yet (including one that FAILED to
-- send: send-email leaves status='approved' with send_error set on failure,
-- see supabase/functions/send-email/index.ts) was invisible to reviewers.
-- send-email always moves a message to 'sent' regardless of whether it got
-- there via digital approval or Kaiden's paper override, so 'sent' already
-- uniformly covers everything that actually went out — the only real gap was
-- the in-between 'approved' window.
--
-- SCOPE DECISION (approved by Luke 2026-07-22): widen the existing SENT-only
-- policy to also cover APPROVED, rather than adding a second near-duplicate
-- policy. Same column-exposure discipline as before — recipient EMAILS are
-- never exposed, only recipient_count (which will be null/unset on an
-- approved-not-yet-sent row until send-email actually runs).
-- ============================================================================

drop policy if exists email_messages_read_reviewer_sent on public.email_messages;
drop policy if exists email_messages_read_reviewer_history on public.email_messages;
create policy email_messages_read_reviewer_history on public.email_messages
  for select to authenticated
  using (public.is_reviewer() and status in ('approved', 'sent'));

-- ── verify after running ─────────────────────────────────────────────────────
--   -- policy landed, old name gone:
--   select policyname from pg_policies where tablename = 'email_messages'
--     and policyname like 'email_messages_read_reviewer%';
--   -- expect: email_messages_read_reviewer, email_messages_read_reviewer_history
-- ============================================================================
