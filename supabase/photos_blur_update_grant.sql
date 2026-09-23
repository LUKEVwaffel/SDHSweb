-- ============================================================================
-- Photo blur editor — extend the column-scoped UPDATE grant on public.photos.
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
-- Depends on: rhea_comp_photos.sql SECTION 3 (photos_update_curate policy +
--             column-scoped grant — see comment there for why it's scoped).
--
-- The DISPATCH face-blur tool (PhotoSubmissions.jsx) re-uploads the redacted
-- image to a new storage path and repoints the row at it. That needs
-- photo_url/thumb_url/storage_path added to the allowed UPDATE column set —
-- GRANT UPDATE (cols) is additive, so this does not touch the existing grant
-- from rhea_comp_photos.sql. votes_funny/aura/team stay untouchable, same as
-- before.
-- ============================================================================

grant update (photo_url, thumb_url, storage_path)
  on public.photos to authenticated;
