-- ============================================================================
-- EMAIL REVIEW PORTAL — widen email_review_decisions.decision to also record
-- reviewer-initiated deletions. Run in the Supabase SQL editor. Idempotent.
-- Depends on email_review_history.sql (email_review_decisions).
--
-- WHY: delete-review-request (new edge function) lets any active reviewer
-- irreversibly delete a pending review request, but was shipping with zero
-- audit trail — a gap flagged by security review, since this codebase
-- otherwise logs every destructive admin/reviewer action (change_log for
-- admin actions, email_review_decisions for reviewer decisions). Reusing
-- email_review_decisions here — rather than a new table — keeps one
-- append-only log per reviewer instead of two, and 'delete' rows show up
-- naturally in the portal's existing "My History" tab.
-- ============================================================================

alter table public.email_review_decisions
  drop constraint if exists email_review_decisions_decision_check;
alter table public.email_review_decisions
  add constraint email_review_decisions_decision_check
  check (decision in ('approve', 'deny', 'delete'));

-- verify:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--     where conrelid = 'public.email_review_decisions'::regclass
--     and conname = 'email_review_decisions_decision_check';
--   -- expect: CHECK (decision = ANY (ARRAY['approve','deny','delete']))
-- ============================================================================
