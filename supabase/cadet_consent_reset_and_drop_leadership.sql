-- ============================================================================
-- (1) Reset every form on every cadet_consent row back to 'pending' — none
-- have actually been collected yet, the earlier seed/import data was wrong.
-- Clears status + collected_at/collected_by for all three tracked forms
-- (photo consent, DD 3203, datasheet).
--
-- (2) Drop the 3 adult-leadership rows (SAI/Chief, AI, 1SGT) from
-- cadet_consent entirely. They don't need any of these forms, but
-- staff_consent_seed_batch1.sql seeded them anyway (company='staff'), and
-- their status has been feeding OverviewPanel's cadet_consent counts —
-- tainting the dashboard's collected/total percentage. Deleting the rows
-- (not just setting pending) removes them from both the roster view and the
-- dashboard denominator. Matched by name; company='staff' guards against an
-- unrelated future row with the same name in a real company.
--
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni).
-- ============================================================================
BEGIN;

UPDATE public.cadet_consent SET
  consent_status = 'pending',   collected_at = NULL,           collected_by = NULL,
  dd3203_status = 'pending',    dd3203_collected_at = NULL,    dd3203_collected_by = NULL,
  datasheet_status = 'pending', datasheet_collected_at = NULL, datasheet_collected_by = NULL,
  updated_at = now();

DELETE FROM public.cadet_consent
WHERE company = 'staff'
  AND name IN ('Michael Thrasher', 'Jay Kazminski', 'Tim Hodges');

COMMIT;
