-- ============================================================================
-- EMAIL REVIEW PORTAL — sent history + per-reviewer decision log. Run in the
-- Supabase SQL editor. Idempotent. Depends on email_review.sql (email_reviewers,
-- is_reviewer()) and email_system.sql (email_messages).
--
-- WHAT THIS ADDS:
--   • email_review_decisions  — append-only audit log of every approve/deny a
--                                reviewer has ever made. email_messages'
--                                reviewed_by/reviewer_feedback columns get
--                                nulled on every resubmit (by design, see
--                                submit-for-review) so they can't answer "what
--                                have I personally said on any draft" — this
--                                table can, because nothing ever overwrites it.
--   • email_messages_read_reviewer_sent — widens the reviewer keyhole to also
--                                see SENT messages (all of them, any active
--                                reviewer — they're part of the approval chain
--                                for everything that goes out, not just what
--                                they personally decided). Recipient EMAILS are
--                                never exposed to reviewers, only the count
--                                already on the row; the app-side query for
--                                this tab must select specific columns, never
--                                '*', since RLS is row-scoped and this policy
--                                sits on the same table as reviewed_by/
--                                created_by/override_by for OTHER people.
--
-- SCOPE DECISION (approved by Luke 2026-07-22): all reviewers see all sent
-- history (not just messages they personally reviewed). Recipient list
-- (individual addresses) intentionally NOT added — email_messages only ever
-- stored recipient_count; sending real addresses to reviewers is a separate,
-- bigger ask not built here.
-- ============================================================================

-- ── SECTION 1 — append-only per-reviewer decision log ───────────────────────
-- message_id is ON DELETE SET NULL, not CASCADE: email_messages_all_s6 grants
-- s6 admins FOR ALL (including DELETE) on email_messages, so a future "clean
-- up old drafts" admin action deleting a message must NOT silently erase the
-- decision history logged against it — that would defeat the point of this
-- table. subject is snapshotted at insert time (by submit-review-decision)
-- for the same reason: history must survive the source row disappearing.
create table if not exists public.email_review_decisions (
  id             uuid primary key default gen_random_uuid(),
  message_id     uuid references public.email_messages(id) on delete set null,
  subject        text,
  reviewer_email text not null,
  decision       text not null check (decision in ('approve', 'deny')),
  feedback       text,
  decided_at     timestamptz not null default now()
);
create index if not exists email_review_decisions_reviewer_idx
  on public.email_review_decisions(reviewer_email, decided_at desc);

alter table public.email_review_decisions enable row level security;

-- A reviewer reads ONLY their own decisions — self-scoped, no cross-reviewer
-- feedback exposure. No insert/update/delete policy for anyone: this table is
-- written exclusively by submit-review-decision via the service-role client,
-- alongside its existing email_messages update.
drop policy if exists email_review_decisions_read_self on public.email_review_decisions;
create policy email_review_decisions_read_self on public.email_review_decisions
  for select to authenticated
  using (lower(reviewer_email) = lower(auth.jwt() ->> 'email'));
revoke all on public.email_review_decisions from anon;


-- ── SECTION 2 — reviewer visibility into SENT messages ──────────────────────
-- OR-combined with the existing email_messages_read_reviewer (pending_review)
-- and email_messages_all_s6 policies — this only ADDS visibility, narrows
-- nothing. Column exposure is the app's responsibility (select id, subject,
-- body_html, sent_at, recipient_count — never '*') since this row also
-- carries reviewed_by/created_by/override_by for whichever admin/reviewer
-- last touched it.
drop policy if exists email_messages_read_reviewer_sent on public.email_messages;
create policy email_messages_read_reviewer_sent on public.email_messages
  for select to authenticated
  using (public.is_reviewer() and status = 'sent');


-- ── SECTION 3 — verify after running ─────────────────────────────────────────
--   -- no anon leak:
--   select has_table_privilege('anon','email_review_decisions','select');  -- false
--   -- reviewer can only ever see their own decisions (run as a reviewer):
--   select * from public.email_review_decisions;  -- rows all match your email
-- ============================================================================
