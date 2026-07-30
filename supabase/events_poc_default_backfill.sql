-- ============================================================================
-- EVENTS POC DEFAULT BACKFILL — set the standing default POC (Chief/SAI)
-- on any event that has none. Run in the Supabase SQL editor. Idempotent.
--
-- Matches src/lib/calendar.js DEFAULT_POC.name — keep both in sync if this
-- ever changes. Editable per-event afterward via EventsPanel.
-- ============================================================================

update public.events
set poc = 'Michael Thrasher (Chief/SAI)'
where poc is null;
