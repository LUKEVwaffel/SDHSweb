-- ============================================================================
-- Achievement catalog + assignments, parsed from bio_long text (see
-- personnel_bios_import.sql / personnel_bios_luke_alayna.sql). Run in the
-- Supabase SQL editor AFTER achievements.sql. Idempotent (ON CONFLICT DO
-- NOTHING on both inserts, safe to re-run).
--
-- Every row shares one placeholder icon — a small flat gold medallion PNG,
-- embedded as a data URI so this file needs no storage upload to run. Swap
-- real icons in later via DISPATCH → Achievements → REPLACE ICON per row.
--
-- Judgment calls made during parsing (approved by Luke 2026-07-24):
--   - "Korean War Veteran Award" and William Boyd's "Korean War Medal" are
--     treated as the same award (merged), not two separate catalog entries.
--   - Michael McCauley's county dual-exhibition placement has no official
--     name in his bio — catalogued as "County Dual Exhibition — 1st Place"
--     rather than inventing a formal-sounding title.
--   - "JCLC Selection" catalogs JCLC attendance/invitation as a named honor
--     even though bios phrase it as "attended" / "a trip to", since it's a
--     selective leadership-course invite, not open enrollment.
--   - Kylie Gray's Cadet Challenge Award and Michael Thrasher's ARCOM/AAM/MSM
--     are recipient counts (x2, x6, x3) captured in the assignment `note`,
--     not duplicate achievement rows — the schema has one row per cadet per
--     achievement type.
-- ============================================================================

BEGIN;

WITH icon AS (
  SELECT 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAACS0lEQVR42u1bO46DMBBNlQOkS5s2Z0iLuMQWS0uJaLbwJejTR0qdKyx7AHoapK0o03rHK68UjWzAgPksz9Jr4oDnPY+Z8WB2OzQ0NLSJ2vfnx4kQECJCShAaqf5N9Z3+E+GzJvcg1ATZEbW+Rl17XhvpPSEm5A6E25Dre+6XTlw4zrQraj3Gfmnk1fqt2gh83d4PhAvhjZAQhEaif1N9hw5CqLGiJRA/Eu4tpENCRigIsgkv1xWEjBC2CKHGPs5FPrDNup5pNbNlG2lG3IRSuX2DZygbgjlc3jbjythnF+IdyL9C3VM09EdTkY8bXL3oStyR/N8YUo9hWxrxLDOvZ136JM9EkA3eEPlc8yaDrlORZwL8jm35X+DjaV8ZjLl1NNSXADYbqlGjgyXUXXsaPLYANk+4+1z3oq/hQ7PBBs8Soz8PdHrLXT8cYrxHAaQhOlSD0mbLTBcec/2hAphsE0Nmvx7q+hMLYFoKdS8v4AmPTkWfKxDgaUib4z4C5DzZWQF5mxfkfSo5fPByjIfYRAKUhuvPLgKkhjxfzi2AozA8IqQuAjzYANmSBbCIkbG+h4sANbtpMVYmN6EIPCTWLqVrXtyQaxLgRQQeDU7Ouz5dp5MrFeHivEvkub8uVso1iqBsd94bGCJA4mtrOwES50jA092u1Z6FCiCc9wUQAEsAD8HNh8FtJ0KbT4WxGcJ2GAURlMRQFEVZHC9G8GoML0fxehwHJHBEBoekcEwOByVxVBaHpXFcHh9M4JMZfDQ1niDb+mwODQ1t8e0HGq8trNY4UgkAAAAASUVORK5CYII=' AS url
)
INSERT INTO achievements (slug, name, icon_url)
SELECT v.slug, v.name, icon.url
FROM (VALUES
  ('superior-cadet',                          'Superior Cadet'),
  ('hamilton-county-best-cadet-4th',          'Hamilton County Best Cadet Competition (4th Place)'),
  ('solo-exhibition-county-championship',     'Solo Exhibition County Championship'),
  ('jclc-selection',                          'JCLC Selection'),
  ('idr-knockout-county-championship',        'IDR Knockout County Championship (1st Place)'),
  ('distinguished-cadet',                     'Distinguished Cadet'),
  ('american-legion-military-excellence-award','American Legion Military Excellence Award'),
  ('korean-war-veteran-award',                'Korean War Veteran Award'),
  ('county-dual-exhibition-1st',              'County Dual Exhibition (1st Place)'),
  ('national-scholar-athlete-award',          'National Scholar-Athlete Award'),
  ('cadet-challenge-award',                   'Cadet Challenge Award'),
  ('one-rope-bridge-event-1st',               'One Rope Bridge Event (1st Place)'),
  ('dandelion-medal',                         'Dandelion Medal'),
  ('most-improved-female-raider',             'Most Improved Female Raider'),
  ('sharpshooter-badge',                      'Sharpshooter Badge'),
  ('meritorious-service-medal',               'Meritorious Service Medal'),
  ('joint-commendation-medal',                'Joint Commendation Medal'),
  ('army-commendation-medal',                 'Army Commendation Medal'),
  ('army-achievement-medal',                  'Army Achievement Medal'),
  ('parachutist-badge',                       'Parachutist Badge'),
  ('netherlands-foreign-jump-wings',          'Netherlands Foreign Jump Wings'),
  ('bronze-star-medal',                       'Bronze Star Medal'),
  ('master-combat-infantryman-badge',         'Master Combat Infantryman Badge')
) AS v(slug, name), icon
ON CONFLICT (slug) DO NOTHING;


-- ── Assignments ──────────────────────────────────────────────────────────
INSERT INTO cadet_achievements (personnel_id, achievement_id, note)
SELECT x.personnel_id, a.id, x.note
FROM (VALUES
  ('bc',             'superior-cadet',                           NULL),
  ('bc',             'hamilton-county-best-cadet-4th',            NULL),
  ('bc',             'solo-exhibition-county-championship',       NULL),

  ('alpha-1sg',      'jclc-selection',                            NULL),
  ('delta-1sg',      'jclc-selection',                            NULL),
  ('alpha-cdr',      'jclc-selection',                            NULL),
  ('charlie-cdr',    'jclc-selection',                             NULL),
  ('raider-female',  'jclc-selection',                             NULL),

  ('s4-draevin',     'idr-knockout-county-championship',          NULL),
  ('s4-draevin',     'distinguished-cadet',                       NULL),
  ('s4-draevin',     'american-legion-military-excellence-award', NULL),
  ('s4-draevin',     'korean-war-veteran-award',                  NULL),
  ('s6-kaiden',      'korean-war-veteran-award',                  NULL),
  ('charlie-1sg',    'korean-war-veteran-award',                  'Bio phrases this as "Korean War Medal," merged with Korean War Veteran Award'),

  ('s5-michael',     'county-dual-exhibition-1st',                NULL),

  ('s3-kylie',       'national-scholar-athlete-award',            NULL),
  ('s3-kylie',       'cadet-challenge-award',                     'Two-time recipient'),

  ('csm',            'one-rope-bridge-event-1st',                 'Multiple 1st-place finishes this year, as Raider Commander'),
  ('raider-male',    'one-rope-bridge-event-1st',                 'Multiple 1st-place finishes this year, as Raider Commander'),

  ('s1-aubrey',      'dandelion-medal',                           NULL),

  ('charlie-cdr',    'most-improved-female-raider',                NULL),
  ('raider-female',  'most-improved-female-raider',                NULL),

  ('alpha-cdr',      'sharpshooter-badge',                        NULL),

  ('leadership-sai', 'meritorious-service-medal',                 'Awarded 3 times (MSM)'),
  ('leadership-sai', 'joint-commendation-medal',                  NULL),
  ('leadership-sai', 'army-commendation-medal',                   'Awarded 6 times (ARCOM)'),
  ('leadership-sai', 'army-achievement-medal',                    'Awarded 6 times (AAM)'),
  ('leadership-sai', 'parachutist-badge',                         NULL),
  ('leadership-sai', 'netherlands-foreign-jump-wings',            NULL),

  ('leadership-kaz', 'bronze-star-medal',                         NULL),
  ('leadership-kaz', 'master-combat-infantryman-badge',           NULL)
) AS x(personnel_id, slug, note)
JOIN achievements a ON a.slug = x.slug
ON CONFLICT (personnel_id, achievement_id) DO NOTHING;

COMMIT;
