-- ============================================================================
-- EMAIL AUDIENCE GROUPS — display label for a targeted send. Run in the
-- Supabase SQL editor. Idempotent.
--
-- The actual targeting mechanism (email_messages.recipient_emails) already
-- exists — see supabase/opticsend.sql SECTION 6/6, read by send-email as-is.
-- This column is purely cosmetic: it lets Messages.jsx show "🎯 ALPHA
-- COMPANY (23 recipients)" instead of a raw email dump when an admin picks
-- one of the new Staff / Company Command / per-company / All Cadets groups
-- (resolved client-side in src/lib/emailAudience.js, written alongside
-- recipient_emails on save). NULL for a plain full-broadcast draft or an
-- OpticSend-sourced row, same as recipient_emails today.
-- ============================================================================

alter table public.email_messages
  add column if not exists recipient_group text;
