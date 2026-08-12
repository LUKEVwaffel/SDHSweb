-- ============================================================================
-- TV SCREENS — registry for multiple physical /tv kiosks. Run AFTER
-- tv_control_center.sql, tv_control_center_bell_schedule.sql, and
-- tv_broadcast.sql (this file extends tv_daily_settings, which those create).
-- Run in the Supabase SQL editor (idempotent).
--
-- Previously tv_daily_settings was a hard singleton (id = 'default', enforced
-- by a check constraint) shared by every physical kiosk in the building. With
-- a second TV (Range) needing independently controllable content, and a third
-- (Staff Room 2) planned but not yet scoped, `id` becomes a per-screen slug
-- instead of a forced constant. The 'default' row (Outside) is untouched —
-- same id, same data, same RLS, same triggers. This migration is additive
-- only; Outside's current behavior does not change.
--
-- tv_screens is a lightweight registry (label + intended route), not a source
-- of truth the frontend reads to generate routes — routes are still declared
-- explicitly in App.jsx. Its job is (a) the FK target that replaces the old
-- singleton check constraint, extensibly, and (b) a stable place to hang a
-- label for the DISPATCH TV Remote's screen selector.
-- ============================================================================

create table if not exists public.tv_screens (
  slug        text primary key,
  label       text not null,
  path        text not null unique,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

insert into public.tv_screens (slug, label, path, sort_order) values
  ('default',    'Outside',        '/tv',            0),
  ('range',      'Range',          '/tv/range',       1),
  ('staffroom2', 'Staff Room 2',   '/tv/staffroom2',  2)
on conflict (slug) do nothing;

alter table public.tv_screens enable row level security;

drop policy if exists tv_screens_select on public.tv_screens;
create policy tv_screens_select on public.tv_screens for select using (true);

grant select on public.tv_screens to anon, authenticated;
-- No insert/update/delete policy — screens are registered by migration, not
-- from the app. Staff Room 2 is deliberately seeded now with no matching
-- tv_daily_settings row and no route/kiosk built yet — "reserved slug," not
-- a working screen. Wire it up later by inserting its tv_daily_settings row
-- and adding the route, same steps 'range' goes through here.

-- ── Un-pin tv_daily_settings.id from the 'default' singleton ────────────────
alter table public.tv_daily_settings
  drop constraint if exists tv_daily_settings_singleton;

alter table public.tv_daily_settings
  drop constraint if exists tv_daily_settings_screen_fk;
alter table public.tv_daily_settings
  add constraint tv_daily_settings_screen_fk
  foreign key (id) references public.tv_screens(slug);

-- ── Range's own row ──────────────────────────────────────────────────────────
-- range_schedule_config drives the Range TV's period-based schedule engine
-- (src/lib/tvRangeSchedule.js). Every string in it is a template the Schedule
-- Editor tab in TV Remote can edit — nothing about the schedule is hardcoded
-- in the frontend. Only meaningful on the 'range' row; left null elsewhere.
alter table public.tv_daily_settings
  add column if not exists range_schedule_config jsonb;

insert into public.tv_daily_settings (id, range_schedule_config) values (
  'range',
  jsonb_build_object(
    'period_company', jsonb_build_object(
      '2', 'Alpha', '3', 'Staff/Command', '4', 'Bravo', '5', 'Charlie', '6', 'Delta'
    ),
    'welcome_window_minutes', 20,
    'planning_message', 'Enjoy your Planning period',
    't2_message', 'It''s T2 time',
    'lunch1_welcome_message', 'Welcome First Lunch',
    'lunch1_reminder_text', 'This is a privilege to sit in here and eat lunch, don''t abuse it. All cadets wanting to eat lunch should come within the first 10 minutes of the lunch and cannot leave after that before the ending of the lunch.',
    'company_welcome_template', 'Welcome {company} Company',
    'attendance_reminder_template', '1SGT: Take attendance now'
  )
) on conflict (id) do nothing;

-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select * from public.tv_screens order by sort_order;
--   select id, range_schedule_config from public.tv_daily_settings order by id;
--   -- Outside must still be exactly one row, untouched:
--   select * from public.tv_daily_settings where id = 'default';
-- ============================================================================
