-- ============================================================================
-- EMAIL MESSAGES — widen the authenticated column grants so saveDraft() can
-- store a targeted audience. Run in the Supabase SQL editor. Idempotent.
-- Depends on: email_review_revoke_override.sql (which first column-restricted
-- these grants), opticsend.sql SECTION 5 (recipient_emails), and
-- email_audience_groups.sql (recipient_group).
--
-- WHY: email_review_revoke_override.sql locked authenticated INSERT/UPDATE on
-- email_messages down to {subject, body, body_html, content_json[, created_by]}
-- — correct at the time, when saveDraft() only ever wrote draft content. The
-- audience-group picker added since (src/lib/emailAudience.js + Messages.jsx)
-- also writes recipient_emails / recipient_group, so every s6 save now fails
-- with "permission denied for table email_messages". This adds exactly those
-- two columns to the grant and nothing else.
--
-- SECURITY: status / reviewed_by / reviewed_at / submitted_at / sent_at /
-- recipient_count / send_error stay OUT of the grant, so the digital review
-- gate is unchanged — send-email still re-checks status='approved' server-side
-- regardless of who a draft is addressed to. recipient_emails only scopes
-- delivery; recipient_group is a cosmetic label. Both are things an s6 admin
-- is already trusted to set when composing.
-- ============================================================================

-- Make sure the columns exist before granting on them (no-ops if already there).
alter table public.email_messages
  add column if not exists recipient_emails text[],
  add column if not exists recipient_group  text;

-- Grants are additive — re-grant the full intended column list for each verb.
grant update (subject, body, body_html, content_json, recipient_emails, recipient_group)
  on public.email_messages to authenticated;

grant insert (subject, body, body_html, content_json, created_by, recipient_emails, recipient_group)
  on public.email_messages to authenticated;

-- ── verify after running ─────────────────────────────────────────────────────
--   select column_name, privilege_type
--     from information_schema.column_privileges
--    where table_name = 'email_messages' and grantee = 'authenticated'
--    order by privilege_type, column_name;
--   -- expect recipient_emails + recipient_group present for INSERT and UPDATE
