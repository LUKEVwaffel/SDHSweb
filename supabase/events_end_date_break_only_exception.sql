-- ============================================================================
-- EVENTS END_DATE CONSTRAINT — targeted exception for one grandfathered
-- multi-day non-BREAK event. Run in the Supabase SQL editor. Idempotent.
--
-- BACKGROUND: events_ironclad.sql added events_end_date_break_only_check
-- (end_date only valid for category='BREAK') as `not valid`, so it never
-- retroactively broke existing rows — but any future UPDATE to a violating
-- row re-checks it and fails. 'East Hamilton HS Academic Bowl'
-- (id 90a4b4da-67d1-43c9-b65a-36f5bacf36d0) is a legitimate 3-day
-- competition seeded under category ACADEMIC with end_date set. This is a
-- one-off grandfathered exception, not a general relaxation — the BREAK-only
-- rule still applies to every other event, including future inserts.
-- ============================================================================

alter table public.events drop constraint if exists events_end_date_break_only_check;
alter table public.events
  add constraint events_end_date_break_only_check
  check (
    end_date is null
    or category = 'BREAK'
    or id = '90a4b4da-67d1-43c9-b65a-36f5bacf36d0'
  ) not valid;
