-- ============================================================================
-- GALLERY REMOVAL — the admin-curated "last year" gallery feature is gone.
-- Confirmed zero public consumers before writing this: `gallery` was already
-- LOCKED (authenticated-only, no anon read at all — see auth_rls.sql SECTION
-- C) and the only code that ever queried it was the admin RaiderGallery.jsx
-- panel, which has been deleted. Run in the Supabase SQL editor.
--
-- Storage note: any files under team-photos/<team>/gallery/* are now orphaned
-- (RaiderGallery.jsx was the only writer/deleter of that prefix). Left in
-- place — not referenced by any DB row after this drop, harmless if kept.
-- Clean up manually via the Storage dashboard if desired.
-- ============================================================================

drop table if exists public.gallery cascade;

-- ============================================================================
-- Done. Verify: select * from information_schema.tables where table_name = 'gallery';
-- ============================================================================
