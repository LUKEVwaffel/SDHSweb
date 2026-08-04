-- ============================================================================
-- EVENTS MULTI-CALENDAR — let an event also appear on team calendars beyond
-- its owning `events.team`. Run in the Supabase SQL editor. Idempotent.
--
-- BACKGROUND: `events.team` is the single owning calendar and drives every
-- permission/constraint rule (S-5 write scope in admin_roles.sql/opticsend.sql
-- SECTION 9, the ironclad uniform exemption in events_ironclad.sql, the
-- Raiders-only recurrence expansion in events_recurrence.sql). Converting it
-- to a multi-value column would mean rewriting every one of those checks at
-- once. Instead this is purely additive: `team` keeps its exact current
-- meaning, and event_secondary_teams just tags EXTRA calendars an event
-- should also render on. Same shape as event_voting_topics (opticsend.sql).
--
-- Depends on: admin_roles.sql (is_s6()/is_s5(), public.events),
-- opticsend.sql (SECTION 9 events RLS amendment must already be applied).
-- ============================================================================

-- ── 1. Join table ────────────────────────────────────────────────────────
create table if not exists public.event_secondary_teams (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  team       text not null check (team in ('raiders','rifle','academic','drill')),
  created_at timestamptz not null default now(),
  unique (event_id, team)
);
create index if not exists event_secondary_teams_event_idx on public.event_secondary_teams(event_id);

-- Reject tagging an event with the same team it already owns via `team` —
-- that's just redundant, not a second calendar.
alter table public.event_secondary_teams drop constraint if exists event_secondary_teams_not_owning_team_check;
create or replace function public._event_secondary_team_not_owning()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.events e where e.id = new.event_id and e.team = new.team) then
    raise exception 'team % is already the owning calendar for event %', new.team, new.event_id;
  end if;
  return new;
end;
$$;
drop trigger if exists event_secondary_teams_not_owning_trg on public.event_secondary_teams;
create trigger event_secondary_teams_not_owning_trg
  before insert or update on public.event_secondary_teams
  for each row execute function public._event_secondary_team_not_owning();

-- ── 2. RLS — mirrors event_voting_topics exactly (opticsend.sql SECTION 7).
-- Public read (non-sensitive, same posture as the parent event). Write: s6
-- anywhere, s5 only on events it can already touch (own team null/raiders)
-- AND only ever tagging 'raiders' — s5 has no other team to grant.
alter table public.event_secondary_teams enable row level security;
select public._drop_all_policies('event_secondary_teams');
create policy event_secondary_teams_read_public on public.event_secondary_teams
  for select to anon, authenticated using (true);
create policy event_secondary_teams_write_admin on public.event_secondary_teams
  for all to authenticated
  using (
    public.is_s6() or (
      public.is_s5() and team = 'raiders' and exists (
        select 1 from public.events e
         where e.id = event_secondary_teams.event_id and (e.team is null or e.team = 'raiders')
      )
    )
  )
  with check (
    public.is_s6() or (
      public.is_s5() and team = 'raiders' and exists (
        select 1 from public.events e
         where e.id = event_secondary_teams.event_id and (e.team is null or e.team = 'raiders')
      )
    )
  );

-- ── 3. Read-side view — team-page queries filter on `calendar_team` instead
-- of `events.team` directly, picking up both the owning team and any
-- secondary tags with no client-side merge logic. security_invoker so it
-- runs under the QUERYING user's RLS on events / event_secondary_teams
-- (not the view owner's) — required on Postgres 15+/Supabase or the view
-- would silently bypass row security.
create or replace view public.events_by_calendar
  with (security_invoker = true) as
  select e.*, e.team as calendar_team
  from public.events e
  union all
  select e.*, est.team as calendar_team
  from public.events e
  join public.event_secondary_teams est on est.event_id = e.id;

-- ============================================================================
-- Verify: \d public.event_secondary_teams
--         select * from public.events_by_calendar where calendar_team = 'raiders';
-- ============================================================================
