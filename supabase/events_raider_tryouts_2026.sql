-- ============================================================================
-- RAIDER TRYOUTS 2026 — single event seed. Run in the Supabase SQL editor.
-- Idempotent (guarded by title+date NOT EXISTS, same pattern as events_calendar.sql).
--
-- Battalion-wide (team NULL), not Raiders-scoped — every cadet is eligible to
-- try out, so this must show on the main battalion calendar, not just the
-- Raiders team calendar. category='RAIDER' still flags it visually (green
-- pill) as Raiders-related content.
--
-- status='posted' requires event_time under events_ironclad.sql's posting
-- gate (category isn't UNIFORM_DAY) — set to the tryout start time.
-- ============================================================================

insert into public.events (title, date, team, category, event_time, status, will_have_pictures)
select 'Raider Tryouts', '2026-08-16'::date, null, 'RAIDER', '14:30:00'::time, 'posted', false
where not exists (
  select 1 from public.events e where e.title = 'Raider Tryouts' and e.date = '2026-08-16'
);
