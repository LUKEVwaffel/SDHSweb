-- ============================================================================
-- RIFLE ROSTER CLEANUP — 2026-2027 season kickoff, take 2.
-- Run in the Supabase SQL editor. Idempotent.
--
-- Checked live: these 7 rifle_shooters rows have zero rifle_scores rows —
-- Luke confirmed they're previous years' varsity, not this year's team.
-- Jayde Walker also has zero scores (she's new this season) and is
-- deliberately NOT in this list.
--
-- "Aidan O'Brien" is a duplicate rifle_roster_sync_2026.sql accidentally
-- created — the real person already exists as "Aiden O'Brein" (with actual
-- scores on record, just a typo'd spelling). Deleting the empty duplicate
-- and correcting the surviving row's name.
-- ============================================================================

delete from public.rifle_shooters
where lower(trim(name)) in (
  lower('Blaylock Duncan'),
  lower('Camryn Davis'),
  lower('Curtis Burchard'),
  lower('Dane Hubbard'),
  lower('Preston Saylor'),
  lower('Rhys Drake'),
  lower('Aidan O''Brien') -- the empty duplicate; the real record is "Aiden O'Brein" below
);

update public.rifle_shooters
set name = 'Aidan O''Brien'
where lower(trim(name)) = lower('Aiden O''Brein');

-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select name, active from public.rifle_shooters order by name;
--   -- Jayde Walker still present; the 6 named-above are gone; "Aiden
--   -- O'Brein" is now spelled "Aidan O'Brien" and still has his scores
--   -- (rifle_scores.shooter_id is unaffected by a name-column update).
-- ============================================================================
