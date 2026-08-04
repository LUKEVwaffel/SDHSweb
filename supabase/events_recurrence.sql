-- ============================================================================
-- EVENTS RECURRENCE — one row spans a whole recurring weekly series (e.g.
-- Raiders practice, Mon-Thu, all season) instead of one row per occurrence.
-- Run in the Supabase SQL editor. Idempotent.
--
-- MODEL: `date` = series start, `end_date` = series end, `recurrence_days` =
-- array of JS Date.getDay() weekday numbers (0=Sun...6=Sat) the event repeats
-- on. NULL recurrence_days = normal one-off event, unchanged behavior.
--
-- Expansion into calendar days happens client-side (src/lib/calendar.js
-- eventOccursOnDate) and is opt-in per calendar — ONLY the Raiders team
-- calendar (src/components/Raiders.jsx) calls it. The main /events calendar
-- and Bulletin never call the expansion, so a recurring row just renders once
-- on its literal `date` there. No special-casing of data needed to keep this
-- Raiders-only in practice; any team could technically get a recurring row,
-- but nothing else consumes it.
--
-- Depends on: events_ironclad.sql (adds the end_date-only-BREAK constraint,
-- loosened here to also allow end_date when recurrence_days is set).
-- ============================================================================

-- ── 1. New column ────────────────────────────────────────────────────────
alter table public.events
  add column if not exists recurrence_days smallint[];

-- ── 2. Validity: 1-7 distinct weekday numbers in [0,6] ──────────────────
alter table public.events drop constraint if exists events_recurrence_days_valid_check;
alter table public.events
  add constraint events_recurrence_days_valid_check
  check (
    recurrence_days is null
    or (
      array_length(recurrence_days, 1) between 1 and 7
      and recurrence_days <@ array[0,1,2,3,4,5,6]::smallint[]
    )
  ) not valid;

-- Recurring series must have a known end (no open-ended weekly repeats).
alter table public.events drop constraint if exists events_recurrence_requires_end_date_check;
alter table public.events
  add constraint events_recurrence_requires_end_date_check
  check (recurrence_days is null or end_date is not null) not valid;

-- ── 3. Loosen the BREAK-only end_date rule to also allow a recurring
-- series' date range. Keeps the existing grandfathered one-off exception
-- from events_end_date_break_only_exception.sql.
alter table public.events drop constraint if exists events_end_date_break_only_check;
alter table public.events
  add constraint events_end_date_break_only_check
  check (
    end_date is null
    or category = 'BREAK'
    or recurrence_days is not null
    or id = '90a4b4da-67d1-43c9-b65a-36f5bacf36d0'
  ) not valid;

-- ============================================================================
-- Verify: \d public.events   -- confirm recurrence_days + constraints
-- ============================================================================
