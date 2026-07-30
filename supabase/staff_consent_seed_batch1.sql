-- ============================================================================
-- STAFF/COMMAND consent seed — from consent_status.csv (31 rows), matched by
-- name against `personnel`. cadet_consent had 0 rows before this ran, so this
-- is a seed (INSERT), not an UPDATE of existing rows. company='staff' for all.
--
-- Includes one personnel data fix: "Mia Sneidman" (id=xo) was a typo — her
-- name is "Mya Sneidman" everywhere else in the project (battalion command,
-- Raiders XO). Fixed here so cadet_consent name-matching lines up with the
-- corrected personnel.name going forward.
--
-- Tim Hodges (leadership-1sgt) wasn't in the CSV — seeded as 'pending' anyway
-- for roster consistency (every staff/command person gets a row).
--
-- consent_form_received=true  -> consent_status='collected', collected_at=now()
-- consent_form_received=false -> consent_status='pending'
--
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). NOT idempotent
-- — re-running duplicates rows (no unique constraint on cadet_consent.name).
-- Verify `select count(*) from cadet_consent where company='staff';` = 0
-- before running twice.
-- ============================================================================
BEGIN;

UPDATE personnel SET name = 'Mya Sneidman' WHERE id = 'xo' AND name = 'Mia Sneidman';

INSERT INTO public.cadet_consent (name, company, consent_status, collected_at, collected_by) VALUES
  ('Brayden Gray',        'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Presley Morgan',      'staff', 'pending',   NULL,  NULL),
  ('Cooper Higginbotham', 'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Aiden O''Brien',      'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Isabella Myers',      'staff', 'pending',   NULL,  NULL),
  ('Brock Beeler',        'staff', 'pending',   NULL,  NULL),
  ('Monica Suttles',      'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Draevin Kidd',        'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Lachlan Redlin',      'staff', 'pending',   NULL,  NULL),
  ('Kaiden Gray',         'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Skyla Hern',          'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Michael McCauley',    'staff', 'collected', now(), 'import:consent_status.csv'),
  ('William Boyd',        'staff', 'pending',   NULL,  NULL),
  ('Alayna Herpy',        'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Aaron Johnson',       'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Luke Vetsch',         'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Kylie Gray',          'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Michael Thrasher',    'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Mya Sneidman',        'staff', 'pending',   NULL,  NULL),
  ('Suzanne Perry',       'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Weston Noblit',       'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Danielle Zonato',     'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Aubrey Gillot',       'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Aryanna Shirey',      'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Chase Otto',          'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Makaio Roos',         'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Zoe McCollum',        'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Aiden Clifton',       'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Jay Kazminski',       'staff', 'collected', now(), 'import:consent_status.csv'),
  ('Jennie Howard',       'staff', 'collected', now(), 'import:consent_status.csv'),
  ('William Baker',       'staff', 'pending',   NULL,  NULL),
  ('Tim Hodges',          'staff', 'pending',   NULL,  NULL);

COMMIT;
