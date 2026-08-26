-- Add Mason Ray Myers to Alpha company — new cadet_consent row.
-- Run in the Supabase SQL editor. cadet_consent is s6-auth-locked (see
-- cadet_consent_block_kaiden_write.sql / auth_rls.sql) so this can't go
-- through the anon key — must be run here or via the admin PeoplePanel
-- Consent section's own Add-cadet UI.
--
-- Checked against existing rows first (see cadet_consent_let1_correction.sql,
-- cadet_consent_birthdates.sql, staff_consent_seed_batch1.sql) — no existing
-- Mason Ray Myers, Mason Myers, or close match on file. Distinct from the
-- existing 'Mason McMeans' (alpha) and 'Isabella Myers' (staff).
--
-- Idempotent via a name+company existence check — safe to re-run.
BEGIN;

INSERT INTO public.cadet_consent (name, company, sort_order)
SELECT
  'Mason Ray Myers',
  'alpha',
  (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM public.cadet_consent WHERE company = 'alpha')
WHERE NOT EXISTS (
  SELECT 1 FROM public.cadet_consent
  WHERE company = 'alpha' AND name ILIKE 'Mason Ray Myers'
);

COMMIT;
