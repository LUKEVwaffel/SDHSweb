-- ============================================================================
-- EVENTS = single source of truth for the battalion + team calendars.
-- Run in the Supabase SQL editor. Idempotent.
--
-- BACKGROUND: there were three disconnected event systems — the public
-- Bulletin.jsx hardcoded array, the upcoming_events table, and this `events`
-- table (real date + nullable team, used by the photo hub). This migration makes
-- `events` the one calendar: adds the calendar columns, seeds the AY 2025–26
-- schedule that previously lived hardcoded in Bulletin.jsx, and retires the dead
-- upcoming_events table.
--
-- MODEL: team NULL = battalion-wide; team in (raiders/rifle/academic/drill) =
-- that specialty team's calendar. category is the color-coded label. status
-- 'posted' shows on the public calendar; 'draft' is admin-only.
-- ============================================================================

-- ── 1. Calendar columns ─────────────────────────────────────────────────────
alter table public.events
  add column if not exists category           text,
  add column if not exists will_have_pictures boolean not null default false,
  add column if not exists location           text,
  add column if not exists time_label         text,
  add column if not exists end_date           date,
  add column if not exists status             text not null default 'posted',
  add column if not exists uniform            text,
  add column if not exists poc                text,
  add column if not exists transportation     text,
  add column if not exists description        text,
  add column if not exists sort_order         int  not null default 0;

-- status guard (draft = admin-only, posted = public)
do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'events' and constraint_name = 'events_status_check'
  ) then
    alter table public.events
      add constraint events_status_check check (status in ('draft','posted'));
  end if;
end $$;

-- Backfill: any pre-existing rows (raider voting events) become posted battalion
-- events unless already tagged, so nothing silently disappears from the public
-- calendar. category left NULL renders under a neutral "EVENT" pill.
update public.events set status = 'posted' where status is null;

-- ── 2. Seed AY 2025–26 (migrated out of Bulletin.jsx) ───────────────────────
-- Guarded by (title,date) NOT EXISTS so re-running is safe and existing rows are
-- never duplicated. team NULL = battalion; category drives the calendar color.
insert into public.events (title, date, team, category, location, end_date, status, will_have_pictures)
select v.title, v.date, v.team, v.category, v.location, v.end_date, 'posted', false
from (values
  ('Home Football Game'::text,                                   '2025-08-21'::date, null::text,       'FOOTBALL'::text,  null::text,                                        null::date),
  ('Rhea County Raider Competition',                             '2025-08-29',       'raiders',        'RAIDER',          null,                                              null),
  ('Home Football Game',                                         '2025-09-04',       null,             'FOOTBALL',        null,                                              null),
  ('Battalion Rafting Trip',                                     '2025-09-05',       null,             'BATTALION',       null,                                              null),
  ('Spring Hill Raider Competition',                             '2025-09-12',       'raiders',        'RAIDER',          null,                                              null),
  ('Home Football Game',                                         '2025-09-18',       null,             'FOOTBALL',        null,                                              null),
  ('East Hamilton HS Hurricane Battalion Raider Competition',   '2025-09-19',       'raiders',        'RAIDER',          null,                                              null),
  ('Home Football Game',                                         '2025-09-25',       null,             'FOOTBALL',        null,                                              null),
  ('Warren County Raider Competition',                           '2025-09-26',       'raiders',        'RAIDER',          null,                                              null),
  ('JROTC Blood Drive',                                          '2025-09-30',       null,             'BATTALION',       null,                                              null),
  ('Competition & Trophy Ceremony',                             '2025-10-03',       null,             'CEREMONY',        'Chattanooga Central HS',                          null),
  ('Fall Break',                                                 '2025-10-12',       null,             'BREAK',           null,                                              '2025-10-16'),
  ('Rifle Shoulder to Shoulder',                                '2025-10-27',       'rifle',          'RIFLE',           'SD @ HOW',                                        null),
  ('Home Football Game: Senior Night',                          '2025-10-30',       null,             'FOOTBALL',        null,                                              null),
  ('Rifle Shoulder to Shoulder',                                '2025-11-03',       'rifle',          'RIFLE',           'SD @ EH',                                         null),
  ('Rifle Shoulder to Shoulder',                                '2025-11-10',       'rifle',          'RIFLE',           'SC @ SD',                                         null),
  ('Rifle Shoulder to Shoulder',                                '2025-11-17',       'rifle',          'RIFLE',           'BRA @ SD',                                        null),
  ('Rifle Shoulder to Shoulder',                                '2025-12-01',       'rifle',          'RIFLE',           'SD @ CEN',                                        null),
  ('JROTC Blood Drive',                                          '2025-12-01',       null,             'BATTALION',       null,                                              null),
  ('SD Christmas Parade',                                        '2025-12-06',       null,             'BATTALION',       'Predicted',                                       null),
  ('Superintendent''s Match',                                   '2025-12-08',       'rifle',          'RIFLE',           'Ooltewah HS',                                     null),
  ('Red Bank Invitational Drill Competition',                   '2026-01-16',       'drill',          'DRILL',           null,                                              null),
  ('East Hamilton HS Academic Bowl',                            '2026-01-19',       'academic',       'ACADEMIC',        null,                                              '2026-01-21'),
  ('Sale Creek Pot-Licker Drill / Academic Competition',        '2026-01-23',       'drill',          'DRILL',           null,                                              null),
  ('Spring Break',                                               '2026-03-22',       null,             'BREAK',           null,                                              '2026-03-26'),
  ('JROTC Blood Drive',                                          '2026-03-29',       null,             'BATTALION',       null,                                              null),
  ('JROTC Olympics',                                            '2026-04-20',       null,             'JROTC',           'Academic / Raiders / Drill / Rifle @ Hixson HS',  null),
  ('78th Annual Armed Forces Day Parade',                       '2026-05-07',       null,             'BATTALION',       null,                                              null),
  ('Black-Jack Best Cadet Competition',                         '2026-05-14',       'academic',       'ACADEMIC',        'East Hamilton HS',                                null),
  ('Graduation',                                                '2026-05-15',       null,             'CEREMONY',        'Predicted',                                       null)
) as v(title, date, team, category, location, end_date)
where not exists (
  select 1 from public.events e where e.title = v.title and e.date = v.date
);

-- ── 3. Retire the dead upcoming_events table ────────────────────────────────
-- No app code reads it after this migration (EventsPanel + OverviewPanel now use
-- `events`). Its flat date_label/tag format could not be migrated meaningfully.
-- Drop last, after confirming the public calendar renders from `events`.
drop table if exists public.upcoming_events cascade;
