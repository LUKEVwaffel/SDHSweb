-- ============================================================================
-- Adds an Auto/Manual mode on top of the existing bell_schedule column (see
-- tv_control_center_bell_schedule.sql). Run in the Supabase SQL editor
-- (idempotent).
--
-- bell_schedule was purely manual — an admin had to remember to flip it
-- every Normal<->T2 day, and it silently stayed on whatever was last picked
-- if nobody did. The school actually runs a fixed weekly rotation
-- (Mon/Wed/Fri Normal, Tue/Thu T2), so the client now derives that
-- automatically (see weekdayBellSchedule() in src/lib/bellSchedules.js)
-- whenever mode is 'auto' (the default), and only reads bell_schedule
-- itself when an admin has explicitly switched to 'manual' for an
-- exception day (holiday, pep rally, snow day).
-- ============================================================================

alter table public.tv_daily_settings
  add column if not exists bell_schedule_mode text not null default 'auto'
    check (bell_schedule_mode in ('auto', 'manual'));
