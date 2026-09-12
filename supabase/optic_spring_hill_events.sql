-- ============================================================================
-- OPTIC 2.0 — Spring Hill Raider Challenge sub-events, from the MOI's 5
-- stations x the 2 teams SDHS is actually fielding this comp (Male, Coed —
-- coed includes female cadets, no standalone Female team; the MOI's 3-way
-- Male/Coed/Female split is the whole competition's structure across every
-- school, not SDHS's own roster). Run once; guarded by NOT EXISTS so
-- re-running doesn't duplicate rows. Times are intentionally
-- NULL — the MOI confirms there's no pre-set schedule, teams get the actual
-- rotation matrix at the 0715 briefing. Luke tap-stamps starts_at/ends_at
-- live in /lukepwa's EVENTS tab as each heat actually runs.
-- ============================================================================

do $$
declare
  v_event_id uuid := 'fa96f288-3b72-484b-bca3-e69c2f5d0ca3'; -- Spring Hill Raider Competition
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
