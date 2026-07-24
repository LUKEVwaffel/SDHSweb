-- ============================================================================
-- Add a real email column to personnel (Staff/Command).
-- Run in the Supabase SQL editor. Idempotent.
--
-- WHY: the Staff/Command detail view in DISPATCH now surfaces each person's
-- email alongside their photo-consent status. Consent + consent-side emails live
-- in cadet_consent (matched by name); this column is the person's own address as
-- maintained directly on the personnel record.
--
-- RLS: personnel is a PUBLIC-READ table (see auth_rls.sql SECTION A) — anon can
-- SELECT. Emails here are therefore world-readable under the anon key. Staff
-- emails are low-sensitivity, but if that ever matters, move personnel to the
-- LOCKED set or split this column into a separate authenticated-only table.
-- ============================================================================
alter table public.personnel
  add column if not exists email text;
