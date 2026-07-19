-- ============================================================================
-- RETIRE the legacy event-photo system. Run in the Supabase SQL editor.
--
-- CONTEXT: superseded by the unified photos/polls/votes model (photo_hub_v2.sql).
-- The public Pictures page now reads `photos`. Confirmed with Luke: site not live,
-- event_photos content is placeholder — nothing real to lose.
--
-- IRREVERSIBLE. Verify counts first if you want a last look:
--   select count(*) from public.event_photos;   -- expect placeholder rows only
--   select count(*) from public.photo_votes;
-- ============================================================================

-- 1. Legacy tables (photo_votes = old single-vote; event_photos = old gallery).
drop table if exists public.photo_votes  cascade;
drop table if exists public.event_photos cascade;

-- 2. Storage bucket `event-photos`. Empty its objects, then remove the bucket.
--    (Supabase may block bucket DELETE via storage.protect_delete — if the last
--     statement errors, delete the bucket by hand in Dashboard > Storage. The
--     object purge above still runs and is enough.)
delete from storage.objects where bucket_id = 'event-photos';
delete from storage.buckets where id = 'event-photos';

-- ============================================================================
-- After running: one photo system remains — photos / polls / votes / gallery
-- (bucket team-photos). MediaPanel + HealthPanel no longer list event-photos.
-- ============================================================================
