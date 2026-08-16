-- ============================================================================
-- SECOND PARENT EMAIL — extends `cadet_consent`, same pattern as
-- cadet_consent_contact.sql (nullable column on the existing roster, not a
-- new table). Many cadets/staff have two parents/guardians worth reaching;
-- `parent_email` only ever held one. Run in the Supabase SQL editor
-- (project bjgyvmdzcymruunzavni). Idempotent.
-- ============================================================================

alter table public.cadet_consent
  add column if not exists parent_email2 text;
