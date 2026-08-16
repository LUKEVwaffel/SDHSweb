-- ============================================================================
-- Backfill email_subscribers from cadet_consent.school_email.
--
-- The app only auto-enrolls school_email into email_subscribers when a row
-- is saved through PeoplePanel/ConsentSection (see enrollSchoolEmail() in
-- ConsentSection.jsx). Every cadet imported straight into cadet_consent via
-- SQL/CSV (the roster import, staff_consent_seed_batch1.sql, etc.) never
-- passed through that code path, so their school_email is on file but was
-- never subscribed. One-time catch-up; going forward every save still
-- enrolls automatically.
--
-- Dedupes against existing subscribers by email (case-insensitive) and
-- within this batch itself. Run in the Supabase SQL editor
-- (project bjgyvmdzcymruunzavni).
-- ============================================================================
BEGIN;

INSERT INTO public.email_subscribers (email, source, company)
SELECT DISTINCT ON (lower(trim(cc.school_email)))
  lower(trim(cc.school_email)) AS email,
  'manual' AS source,
  cc.company
FROM public.cadet_consent cc
WHERE cc.school_email IS NOT NULL
  AND trim(cc.school_email) <> ''
  AND lower(trim(cc.school_email)) ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
  AND NOT EXISTS (
    SELECT 1 FROM public.email_subscribers es
    WHERE lower(es.email) = lower(trim(cc.school_email))
  );

COMMIT;
