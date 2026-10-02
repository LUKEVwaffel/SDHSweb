-- rifle_matches: let week numbers repeat across seasons.
--
-- rifle_admin_portal.sql created rifle_matches with `unique (week)`, from
-- before the portal had seasons. The spring-2026 season already owns weeks
-- 1–10, so creating "Week 1" for the 2026-2027 season (from the Scores
-- Editor's ADD MATCH or the score import's "+ New match") fails with
--   duplicate key value violates unique constraint "rifle_matches_week_key"
-- Season is derived from the free-text `dates` column (schoolYearOf() in
-- src/components/rifle/portal/rifleStats.js), so a per-season unique index
-- can't be expressed in SQL — drop the constraint; the UI groups by season.
-- Nothing upserts on week (all writes go by id), so no code depends on it.
--
-- Safe to re-run. Run in the Supabase SQL editor.

alter table public.rifle_matches drop constraint if exists rifle_matches_week_key;

-- Keep week ordering cheap now that the unique index (which doubled as the
-- sort index) is gone.
create index if not exists rifle_matches_week_idx on public.rifle_matches (week);

-- Verify (expect no row for rifle_matches_week_key):
--   select conname from pg_constraint
--   where conrelid = 'public.rifle_matches'::regclass and contype = 'u';
