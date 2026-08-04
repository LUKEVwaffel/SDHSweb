-- ============================================================================
-- PHOTOS UPLOADED_BY — track which DISPATCH admin uploaded a photo, separate
-- from the existing `uploader_name` freetext "credit" field (e.g. "Coach
-- Smith"). Only DISPATCH bulk-upload sets this; public/cadet submissions via
-- PhotoUploader.jsx leave it null. Run in the Supabase SQL editor. Idempotent.
-- ============================================================================

alter table public.photos
  add column if not exists uploaded_by text;

-- ============================================================================
-- Done. Verify: select column_name from information_schema.columns
--   where table_name = 'photos' and column_name = 'uploaded_by';
-- ============================================================================
