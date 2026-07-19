-- Raiders page: event tagging + admin-editable team stats.
-- Safe to run multiple times (idempotent). Run in Supabase SQL editor.

-- ── 1. Tag events by specialty team ──────────────────────────────────────────
-- events had no team column, so the calendar could not filter raider events.
-- Nullable: existing/battalion-wide events stay untagged (team IS NULL).
alter table public.events
  add column if not exists team text;

-- Optional guard: keep team values aligned with the app's TEAMS list.
-- (Drop/adjust if you add teams later.)
do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'events' and constraint_name = 'events_team_check'
  ) then
    alter table public.events
      add constraint events_team_check
      check (team is null or team in ('raiders','rifle','academic','drill'));
  end if;
end $$;

create index if not exists events_team_date_idx
  on public.events (team, date);

-- ── 2. Admin-editable team stats (county placement, trophy count, …) ─────────
-- Key/value rows so real numbers can be entered later without code changes.
-- Page renders "stats pending" while a team has zero rows. No values seeded.
create table if not exists public.team_stats (
  id          uuid primary key default gen_random_uuid(),
  team        text not null
                check (team in ('raiders','rifle','academic','drill')),
  label       text not null,            -- e.g. 'COUNTY PLACEMENT', 'ROPE BRIDGE TROPHIES'
  value       text not null,            -- e.g. '1st', '3'  (text: supports '1st', 'x3', etc.)
  sub         text,                     -- optional context line, e.g. 'Hamilton County · 2025'
  sort_order  int  not null default 0,
  updated_at  timestamptz not null default now()
);

create index if not exists team_stats_team_sort_idx
  on public.team_stats (team, sort_order);

-- RLS: public read, writes via service role / authed admin only.
alter table public.team_stats enable row level security;

drop policy if exists team_stats_read on public.team_stats;
create policy team_stats_read
  on public.team_stats for select
  using (true);

-- NOTE: no insert/update/delete policy for anon on purpose.
-- Admin writes use the service-role key (same pattern as other admin writes).
