-- ============================================================================
-- OPTIC grid thumbnails. Run in the Supabase SQL editor. Idempotent.
--
-- /lukepwa's album tiles used to load the ~900px feed thumb (~150KB) to draw
-- a ~120px square. New uploads (and blurs) now also write a ~360px
-- `<base>_s.jpg` (~20KB) and store its URL here; the PWA's "speed up" button
-- backfills older photos. Rows with no grid_url just fall back to thumb_url,
-- and the app retries writes without this column until it exists, so this
-- can be run any time.
--
-- R2: the optic-r2 worker must be redeployed (`npx wrangler deploy` in
-- workers/optic-r2) so it accepts `_s.jpg` keys. Until then grid thumbs are
-- skipped on R2 uploads; nothing else is affected.
-- ============================================================================

alter table public.photos
  add column if not exists grid_url text;

grant update (grid_url) on public.photos to authenticated;
