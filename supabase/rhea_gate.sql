-- ============================================================================
-- RHEA COUNTY RAIDER COMP , beta gate (hold /rhea closed until go time).
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
-- Depends on: admin_roles.sql (is_admin()).
--
-- /rhea is a one-night BETA. Uploads and the live feed stay locked behind a
-- countdown until Luke opens them. Two knobs, one row:
--   opens_at : the scheduled unlock instant (countdown target).
--   is_open  : manual override , flip true to open early, false to re-lock.
-- The feed is considered OPEN when  is_open OR now() >= opens_at.
-- ============================================================================

create table if not exists public.rhea_gate (
  id         text primary key default 'default',
  is_open    boolean not null default false,
  opens_at   timestamptz not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.rhea_gate enable row level security;

drop policy if exists rhea_gate_read  on public.rhea_gate;
drop policy if exists rhea_gate_write on public.rhea_gate;

-- Public read: every /rhea visitor needs the open state + countdown target.
create policy rhea_gate_read on public.rhea_gate
  for select using (true);

-- Write: DISPATCH admins only (same pool as the rest of the Rhea curation UI).
create policy rhea_gate_write on public.rhea_gate
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Seed the single row: locked, opening 8:00 AM Aug 29 2026 (US Eastern).
-- Re-running never clobbers a value Luke has since changed.
insert into public.rhea_gate (id, is_open, opens_at)
values ('default', false, '2026-08-29 08:00:00-04')
on conflict (id) do nothing;

-- Realtime so an OPEN NOW / re-lock from /lukepwa reaches open /rhea tabs.
do $$ begin
  alter publication supabase_realtime add table public.rhea_gate;
exception when duplicate_object then null; end $$;

-- ============================================================================
-- VERIFY:
--   select * from public.rhea_gate;                       -- one row, is_open=false
--   -- open early:   update public.rhea_gate set is_open = true  where id = 'default';
--   -- re-lock:      update public.rhea_gate set is_open = false where id = 'default';
--   -- reschedule:   update public.rhea_gate set opens_at = '2026-08-29 09:30:00-04' where id = 'default';
-- ============================================================================
