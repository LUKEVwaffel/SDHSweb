-- ============================================================================
-- OPTIC 2.0 — East Hamilton Raider Competition sub-events (2026-09-19), same
-- 5 MOI stations x 2 teams SDHS fields as the Spring Hill template
-- (optic_spring_hill_events.sql) this is copied from. Run once; guarded by
-- NOT EXISTS so re-running doesn't duplicate rows. Times are NULL — Luke
-- tap-stamps starts_at/ends_at live in /lukepwa's EVENTS tab as each heat
-- actually runs, same as every prior comp.
-- ============================================================================

do $$
declare
  v_event_id uuid := '0d0eef63-eff6-4988-bc4a-b9686ccc9dd4'; -- East Hamilton Raider Competition
  v_stations text[] := array[
    'Physical Team Test (PTT)',
    'Humvee Load and Push',
    'Cross Country Rescue (CCR)',
    'One Rope Bridge',
    'Obstacle Course (The Juggernaut)'
  ];
  v_teams text[] := array['male', 'coed'];
  v_station text;
  v_team text;
begin
  foreach v_station in array v_stations loop
    foreach v_team in array v_teams loop
      if not exists (
        select 1 from public.raider_sub_events
         where event_id = v_event_id and name = v_station and team = v_team
      ) then
        insert into public.raider_sub_events (event_id, name, team)
        values (v_event_id, v_station, v_team);
      end if;
    end loop;
  end loop;
end $$;

-- ============================================================================
-- Point OPTIC at the new comp: swap which event the live /optic feed +
-- upload pipeline target (useOpticConfig reads this), and reopen the gate on
-- an auto countdown to 2026-09-19 08:00 ET — later than the 0700 check-in on
-- the MOI so the feed doesn't open mid check-in/briefing, same reasoning as
-- every prior comp's opens_at. mode='auto' (not 'open') so it stays locked
-- until then; is_open=false so the legacy force-open lever can't override it.
-- ============================================================================

update public.optic_config
   set active_event_id = '0d0eef63-eff6-4988-bc4a-b9686ccc9dd4', updated_at = now()
 where id = 'default';

update public.rhea_gate
   set mode = 'auto', opens_at = '2026-09-19T08:00:00-04:00', is_open = false, updated_at = now()
 where id = 'default';

-- ============================================================================
-- Verify:
--   select * from public.optic_config;
--   select * from public.rhea_gate;
--   select name, team from public.raider_sub_events where event_id = '0d0eef63-eff6-4988-bc4a-b9686ccc9dd4' order by name, team;
-- ============================================================================
