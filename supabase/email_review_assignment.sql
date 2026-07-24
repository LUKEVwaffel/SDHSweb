-- ============================================================================
-- EMAIL REVIEW PORTAL — single-reviewer assignment. Run in the Supabase SQL
-- editor. Idempotent. Depends on email_review.sql (email_reviewers,
-- email_messages review columns).
--
-- WHAT THIS ADDS:
--   • email_messages.assigned_reviewer_email — which of the 3 reviewers a
--     draft was actually sent to. Set by submit-for-review on every submit /
--     resubmit (overwritten fresh each time, so it always reflects the last
--     pick — no separate nulling step needed like reviewed_by/feedback).
--
-- SCOPE DECISION (approved by Luke 2026-07-22): visibility/authorization on
-- email_messages and submit-review-decision stay UNCHANGED — any active
-- reviewer can still see and decide a pending_review row (RLS keyhole from
-- email_review.sql SECTION 4 is untouched). This column is read client-side
-- only, to let ReviewPortal show "assigned to you" as the primary list and
-- "assigned to someone else" as a fallback section — a UI-level default, not
-- a hard access boundary. Legacy rows (assigned_reviewer_email IS NULL,
-- submitted before this shipped) are treated as visible to everyone in the
-- primary list, since they really were sent to all 3.
-- ============================================================================

alter table public.email_messages
  add column if not exists assigned_reviewer_email text;

create index if not exists email_messages_assigned_reviewer_idx
  on public.email_messages(assigned_reviewer_email);
