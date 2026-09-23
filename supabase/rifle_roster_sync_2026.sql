-- ============================================================================
-- RIFLE ROSTER SYNC — 2026-2027 season kickoff.
-- Run in the Supabase SQL editor. Idempotent.
--
-- WHAT THIS DOES:
--   1. Ensures the current team roster exists in rifle_shooters (from the
--      team's own "Shooters" tab in the 2025-26 tracking spreadsheet + the
--      team Discord member list) with rifle numbers, active status.
--   2. Backfills school_email on EVERY rifle_shooters row that's missing it,
--      by exact name match against cadet_consent (DISPATCH's roster) — same
--      posture as rifle_signups_review_view_cadet_join.sql, run here as a
--      one-off admin script instead of a live view.
--
-- Curtis Burchard is marked inactive — his row in the source spreadsheet had
-- "Injured" where his rifle number should be. Flip back to active whenever
-- that's no longer true.
--
-- Aidan O'Brien's name is spelled 3 different ways across sources this was
-- built from (Discord "Aidan O'Brien", the spreadsheet's "Aidan O'Brein",
-- and an existing DISPATCH "bc" account "Aiden O'Brien") — inserted here
-- using the Discord spelling. If the email backfill below doesn't find him,
-- his school_email needs setting by hand from the Roster tab.
-- ============================================================================

-- ── 1. Ensure the roster exists, active, with rifle numbers ────────────────
insert into public.rifle_shooters (name, rifle_no, active)
select v.name, v.rifle_no, v.active
from (values
  ('Preston Saylor',        1,  true),
  ('Tori Duke',              2,  true),
  ('Jayde Walker',           3,  true),
  ('Aidan O''Brien',         4,  true),
  ('Camryn Davis',           6,  true),
  ('Weston Noblit',          7,  true),
  ('Dane Hubbard',           8,  true),
  ('Kenneth Suttles',        9,  true),
  ('Sofia Juarez Vargas',   10,  true),
  ('Curtis Burchard',       11, false), -- "Injured" in the source sheet
  ('Rhys Drake',            12,  true),
  ('Luke Vetsch',           13,  true),
  ('Makaio Roos',           15,  true),
  ('Blaylock Duncan',       16,  true),
  ('Aiden Clifton',          5,  true)
) as v(name, rifle_no, active)
where not exists (
  select 1 from public.rifle_shooters rs where lower(trim(rs.name)) = lower(trim(v.name))
);

-- Existing rows: make sure they're active and carry a rifle number, without
-- clobbering a rifle_no someone already set by hand to something else.
update public.rifle_shooters rs
set active = true,
    rifle_no = coalesce(rs.rifle_no, v.rifle_no)
from (values
  ('Preston Saylor', 1), ('Tori Duke', 2), ('Jayde Walker', 3), ('Aidan O''Brien', 4),
  ('Camryn Davis', 6), ('Weston Noblit', 7), ('Dane Hubbard', 8), ('Kenneth Suttles', 9),
  ('Sofia Juarez Vargas', 10), ('Rhys Drake', 12), ('Luke Vetsch', 13), ('Makaio Roos', 15),
  ('Blaylock Duncan', 16), ('Aiden Clifton', 5)
) as v(name, rifle_no)
where lower(trim(rs.name)) = lower(trim(v.name));

update public.rifle_shooters
set active = false
where lower(trim(name)) = lower('Curtis Burchard');


-- ── 2. Backfill school_email from DISPATCH (cadet_consent), exact name match
update public.rifle_shooters rs
set school_email = cc.school_email
from public.cadet_consent cc
where rs.school_email is null
  and cc.school_email is not null
  and lower(trim(rs.name)) = lower(trim(cc.name));

-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select name, rifle_no, active, school_email from public.rifle_shooters order by name;
--   -- anyone with school_email still null needs it set by hand (name spelling
--   -- mismatch against cadet_consent, or they're not in DISPATCH's roster yet):
--   select name from public.rifle_shooters where school_email is null order by name;
-- ============================================================================
