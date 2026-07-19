-- ============================================================================
-- CADET CONTACT FIELDS — extends `cadet_consent` into the real cadet database.
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
--
-- Adds two nullable contact columns to the existing consent roster (NOT a new
-- table — consent tracking and the cadet database are the same rows):
--   school_email  — filled by S-6 as school addresses arrive after the roster
--   parent_email  — promoted into email_subscribers for the mailing list via the
--                   "add parent to mailing list" action on the cadet detail view
--
-- No trigger: parent_email → email_subscribers is an explicit, admin-initiated
-- upsert (deduped by email_subscribers.email unique). Keeps sync intentional and
-- avoids ambiguous delete/update cascade semantics.
--
-- PRIVACY NOTE: same posture as cadet_consent.sql — anon key + passcode admin.
-- These emails are readable with the public anon key. Gate behind real Supabase
-- Auth later if that matters. Flagged deliberately.
-- ============================================================================

alter table public.cadet_consent
  add column if not exists school_email text,
  add column if not exists parent_email text;
