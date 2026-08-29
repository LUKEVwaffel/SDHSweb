-- ============================================================================
-- RHEA COUNTY RAIDER COMP , gate kill switch (tri-state).
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent,
-- additive. Depends on: rhea_gate.sql.
--
-- PROBLEM this fixes: the old rule was  OPEN = is_open OR now() >= opens_at.
-- Once the clock passed opens_at, LOCK (is_open=false) did nothing , the time
-- half of the OR kept the feed open, and the only way to re-close was to shove
-- opens_at into the future. No fast kill switch under pressure.
--
-- NEW rule , a real three-way override in `mode`:
--   'closed' : feed LOCKED, always, whatever the clock says. Wins over all.
--   'open'   : feed OPEN, always, whatever the clock says.
--   'auto'   : fall back to the countdown , OPEN when now() >= opens_at.
--
-- The legacy `is_open` column is left in place but is NO LONGER read by the
-- app. Don't rely on it.
-- ============================================================================

alter table public.rhea_gate
  add column if not exists mode text not null default 'auto';

do $$ begin
  alter table public.rhea_gate
    add constraint rhea_gate_mode_chk check (mode in ('auto', 'open', 'closed'));
exception when duplicate_object then null; end $$;

-- Carry the existing row's intent across without changing today's behaviour:
--   old is_open = true  -> forced open  -> 'open'
--   old is_open = false -> was "auto, locked until opens_at" -> 'auto'
-- Only touches the row while mode is still at its freshly-added default, so a
-- re-run never stomps a state Luke has since picked in the UI.
update public.rhea_gate
   set mode = case when is_open then 'open' else 'auto' end
 where id = 'default'
   and mode = 'auto'
   and is_open is distinct from false;  -- is_open=false already maps to 'auto'

-- realtime already covers this table (rhea_gate.sql). postgres_changes ships
-- the whole row, so `mode` reaches open /rhea tabs with no extra config.

-- ============================================================================
-- VERIFY / MANUAL ESCAPE HATCH (works even if the /lukepwa UI is unreachable):
--   select id, mode, opens_at from public.rhea_gate;
--   -- panic lock:   update public.rhea_gate set mode = 'closed' where id = 'default';
--   -- force open:   update public.rhea_gate set mode = 'open'   where id = 'default';
--   -- back to auto: update public.rhea_gate set mode = 'auto'   where id = 'default';
-- ============================================================================
