-- ============================================================================
-- EVENTS BACKFILL — flip already-posted events back to 'draft' if they're
-- missing any field the iron-clad posted-gate requires. Run in the Supabase
-- SQL editor. Idempotent (re-running only re-applies to rows still incomplete).
--
-- BACKGROUND: events_calendar.sql force-set every row to status='posted' when
-- the column was added, regardless of whether the event actually had its
-- required fields (event_time, uniform/transportation/permission-slip
-- answers) filled in. The AY2025-26 seed only ever populated title/date/
-- team/category/location/end_date — everything else is NULL. This mirrors
-- that gap back into status so drafts reflect reality.
--
-- Predicate is the exact inverse of events_posted_requires_fields_check
-- (see events_ironclad.sql / events_uniform_khaki_polo_merge.sql) — an event
-- stays 'posted' only if it already satisfies that same constraint.
--
-- Depends on: events_calendar.sql, events_ironclad.sql,
-- events_uniform_khaki_polo_merge.sql (run this after those).
-- ============================================================================

update public.events
set status = 'draft'
where status = 'posted'
  and not (
    title is not null and title <> '' and
    date is not null and
    category is not null and
    event_time is not null and
    (uniform_required = false or uniform is not null) and
    (transportation_required = false or (transportation is not null and transportation <> '')) and
    (permission_slip_required = false or permission_slip_url is not null)
  );

-- ============================================================================
-- Verify counts before/after:
--   select status, count(*) from public.events group by status;
-- ============================================================================
