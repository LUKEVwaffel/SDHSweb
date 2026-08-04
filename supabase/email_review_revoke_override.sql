-- ============================================================================
-- EMAIL REVIEW PORTAL — revoke the paper-override capability entirely. Run in
-- the Supabase SQL editor. Idempotent. Depends on email_review.sql (SECTION 2,
-- which this reverses).
--
-- POLICY CHANGE: the paper + wet-signature override path (Kaiden's individual
-- can_override_review flag, gating the "Paper override" panel in Messages.jsx)
-- is retired. The digital 3-reviewer portal (email_reviewers / is_reviewer() /
-- submit-review-decision) is now the ONLY approval path — no exceptions, no
-- individual bypass, for anyone.
--
-- SECURITY-REVIEW FINDING (fixed here, not deferred): removing the UI panel
-- alone does NOT close this path. can_override_review() was never referenced
-- by any RLS policy — it only ever gated a client-side button. The actual
-- authorization boundary is email_messages_all_s6 (admin_roles.sql), a
-- column-unrestricted FOR ALL policy: any s6 session (Luke's or Kaiden's) can
-- issue a raw client call — `update email_messages set status='signed', ...`
-- — with zero digital review, zero reviewer notification, and zero row in
-- email_review_decisions. That's worse than the retired paper path, which at
-- least required a real physical signature. So this migration does four
-- things, in order:
--   1. Backfill existing rows out of the retired statuses (see below).
--   2. Narrow the status CHECK constraint so 'pending_signature'/'signed' can
--      no longer be written by ANYONE, client or server.
--   3. Column-restrict authenticated UPDATE on email_messages so an s6 client
--      can only ever edit draft CONTENT (subject/body/body_html/content_json)
--      — every status transition (submit / review decision / send) becomes
--      reachable ONLY through the service-role edge functions, which is the
--      actual control being asked for. Same pattern already used for
--      admin_roles in account_picker.sql.
--   4. Column-restrict authenticated INSERT the same way. A narrowed UPDATE
--      grant alone still leaves a bypass: is_s6()'s WITH CHECK on
--      email_messages_all_s6 only verifies the caller is s6, not which
--      columns/values a NEW row can carry — so an s6 client could otherwise
--      `insert({..., status: 'approved', reviewed_by: 'forged'})` and hand
--      itself a pre-approved row, skipping digital review entirely via INSERT
--      instead of UPDATE. Security-reviewer caught this on the first pass at
--      this migration (an UPDATE-only restriction) — this covers both verbs.
--
-- BACKFILL, run BEFORE narrowing the constraint so no existing row violates it:
--   • status='signed'            → 'approved', with reviewed_by annotated so
--     the origin stays honest in the audit trail (EmailHistoryPanel), and
--     reviewed_at backfilled from signed_at so it still slots into the
--     REVIEWED step. This is what lets a pre-existing signed-but-unsent draft
--     still be sent — through the same 'approved' gate as everything else,
--     not a lingering 'signed' special case in send-email.
--   • status='pending_signature' → 'draft'. It never got a real signature, so
--     it goes back to needing a normal submission through digital review.
-- ============================================================================

update public.email_messages
  set status = 'approved',
      reviewed_by = 'legacy-paper-override:' || coalesce(signed_by, 'unknown'),
      reviewed_at = coalesce(signed_at, now())
  where status = 'signed';

update public.email_messages
  set status = 'draft'
  where status = 'pending_signature';

alter table public.email_messages drop constraint if exists email_messages_status_check;
alter table public.email_messages add constraint email_messages_status_check
  check (status in ('draft','pending_review','changes_requested','approved','sent'));

-- Column-restrict UPDATE: an s6 client can edit draft content, nothing else.
-- Every other column (status, reviewed_*, submitted_at, assigned_reviewer_email,
-- sent_at, recipient_count, send_error, created_by, created_at, and the retired
-- signed_by/signed_at/pdf_generated_at/sign_off_kind/override_by/override_at)
-- becomes writable only by the service-role edge functions, which bypass RLS
-- and column grants entirely. Confirmed via grep: the ONLY authenticated-role
-- write to email_messages left in the app is Messages.jsx's saveDraft(),
-- which only ever sends {subject, body, body_html, content_json} — this grant
-- covers exactly that and nothing more.
revoke update on public.email_messages from authenticated;
grant  update (subject, body, body_html, content_json) on public.email_messages to authenticated;

-- Column-restrict INSERT the same way. created_by IS insertable here — saveDraft
-- sets it on creation — but deliberately stays OUT of the UPDATE grant above,
-- so an existing draft's authorship can't be reassigned after the fact.
-- status is intentionally NOT in this list: it must default to 'draft' (its
-- column default), never be set explicitly by the client on insert.
revoke insert on public.email_messages from authenticated;
grant  insert (subject, body, body_html, content_json, created_by) on public.email_messages to authenticated;

drop function if exists public.can_override_review();

alter table public.admin_roles
  drop column if exists can_override_review;

-- ── verify after running ─────────────────────────────────────────────────────
--   -- no rows left in the retired statuses:
--   select count(*) from public.email_messages where status in ('pending_signature','signed');
--     -- expect 0
--   -- column-restricted UPDATE actually blocks a status write as an s6 session
--   -- (run as an authenticated s6 user, not service_role):
--   --   update email_messages set status = 'approved' where id = '<some id>';
--   --   -- expect: permission denied for column status
--   -- column-restricted INSERT actually blocks a self-approved new row:
--   --   insert into email_messages (subject, body, status, reviewed_by)
--   --     values ('x', 'x', 'approved', 'forged');
--   --   -- expect: permission denied for column status
--   -- can_override_review column/function gone:
--   select column_name from information_schema.columns
--     where table_name = 'admin_roles' and column_name = 'can_override_review';
--     -- expect 0 rows
--   select proname from pg_proc where proname = 'can_override_review';
--     -- expect 0 rows
-- ============================================================================
