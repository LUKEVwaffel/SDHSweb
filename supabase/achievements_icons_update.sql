-- ============================================================================
-- Swap placeholder gold-medallion icon_url (achievements_seed.sql) for real
-- uploaded artwork in the achievement-icons bucket. Run in the Supabase SQL
-- editor AFTER uploading all 23 PNGs (renamed to {slug}.png per the rename
-- script) to achievement-icons via Studio. Idempotent — safe to re-run.
-- ============================================================================

BEGIN;

UPDATE achievements a
SET icon_url = 'https://bjgyvmdzcymruunzavni.supabase.co/storage/v1/object/public/achievement-icons/' || v.slug || '.png'
FROM (VALUES
  ('superior-cadet'),
  ('hamilton-county-best-cadet-4th'),
  ('solo-exhibition-county-championship'),
  ('jclc-selection'),
  ('idr-knockout-county-championship'),
  ('distinguished-cadet'),
  ('american-legion-military-excellence-award'),
  ('korean-war-veteran-award'),
  ('county-dual-exhibition-1st'),
  ('national-scholar-athlete-award'),
  ('cadet-challenge-award'),
  ('one-rope-bridge-event-1st'),
  ('dandelion-medal'),
  ('most-improved-female-raider'),
  ('sharpshooter-badge'),
  ('meritorious-service-medal'),
  ('joint-commendation-medal'),
  ('army-commendation-medal'),
  ('army-achievement-medal'),
  ('parachutist-badge'),
  ('netherlands-foreign-jump-wings'),
  ('bronze-star-medal'),
  ('master-combat-infantryman-badge')
) AS v(slug)
WHERE a.slug = v.slug;

COMMIT;

-- Sanity check — confirm all 23 rows now point at achievement-icons, none
-- still on the old data-URI placeholder.
SELECT slug, icon_url FROM achievements
WHERE icon_url NOT LIKE '%/achievement-icons/%'
ORDER BY slug;
