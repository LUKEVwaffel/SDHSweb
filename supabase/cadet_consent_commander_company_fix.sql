-- ============================================================================
-- COMPANY FIX — Makaio Roos and Zoe McCollum are company/team commanders,
-- not general staff. staff_consent_seed_batch1.sql wrote company='staff' for
-- every row (comment on that file says so explicitly), which was wrong for
-- these two. Zoe McCollum is Charlie Company Commander (personnel id
-- charlie-cdr). Makaio Roos (Rifle Team Commander, personnel id rifle-cmd) is
-- Delta company.
--
-- Matches by exact `name` against existing cadet_consent rows. Does not
-- insert new rows. Safe to re-run.
-- ============================================================================
BEGIN;

UPDATE public.cadet_consent SET company = 'delta'   WHERE name = 'Makaio Roos';
UPDATE public.cadet_consent SET company = 'charlie'  WHERE name = 'Zoe McCollum';

COMMIT;
