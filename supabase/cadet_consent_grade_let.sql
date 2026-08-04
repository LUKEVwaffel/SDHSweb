-- ============================================================================
-- CADET GRADE + LET LEVEL — extends `cadet_consent`, same pattern as
-- cadet_consent_contact.sql (nullable columns on the existing roster, not a
-- new table). Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni).
-- Idempotent.
--
-- `personnel` (the public staff/command directory) already has `let_level`;
-- the full cadet roster in `cadet_consent` never got an equivalent because it
-- started as a pure consent tracker. Adding both here so the add-cadet popup
-- can capture a complete record up front instead of a bare name.
-- ============================================================================

alter table public.cadet_consent
  add column if not exists grade     text, -- '9' | '10' | '11' | '12'
  add column if not exists let_level text; -- '1' | '2' | '3' | '4', matches personnel.let_level convention
