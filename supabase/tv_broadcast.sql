-- ============================================================================
-- TV BROADCAST — Push-to-TV spotlight + Emergency Push. Run AFTER
-- tv_photos.sql (this file relies on public.is_luke(), defined there).
-- Run in the Supabase SQL editor (idempotent).
--
-- Both features extend the existing tv_daily_settings singleton row so the
-- kiosk picks them up on the realtime channel it already has open
-- (useTvDailySettings.js) — no new subscription needed on the kiosk side.
--
-- SPOTLIGHT (single-photo push): restricted to Luke specifically, both the
-- write itself and the trusted-device registration that gates it. This is a
-- deliberate, explicit departure from this codebase's usual "no per-email
-- logic" convention (see admin_roles.sql) — product decision, not a role.
-- Enforcement is server-side in the push-tv-spotlight / register-tv-terminal
-- edge functions (PIN re-verify + fingerprint match), NOT client-side —
-- trusted_devices has no insert policy at all here on purpose, so a trusted
-- device can only ever be registered through the PIN-gated edge function,
-- never a direct authenticated write.
--
-- EMERGENCY PUSH: open to any signed-in admin, no PIN/device gate — product
-- decision, since the point is any admin can act fast on a same-day change.
-- Plain RLS update using is_admin(), same shape as every other admin-write
-- table in this codebase.
-- ============================================================================

alter table public.tv_daily_settings
  add column if not exists spotlight_photo_url text,
  add column if not exists spotlight_active     boolean not null default false,
  add column if not exists spotlight_set_at      timestamptz,
  add column if not exists spotlight_set_by      text,
  add column if not exists emergency_active      boolean not null default false,
  add column if not exists emergency_text        text,
  add column if not exists emergency_header      text,
  add column if not exists emergency_photo_url   text,
  add column if not exists emergency_text_size   text not null default 'normal',
  add column if not exists emergency_set_at      timestamptz,
  add column if not exists emergency_set_by      text;

alter table public.tv_daily_settings
  drop constraint if exists tv_daily_settings_emergency_text_size_check;
alter table public.tv_daily_settings
  add constraint tv_daily_settings_emergency_text_size_check
  check (emergency_text_size in ('normal','large','huge'));

-- SECURITY: tv_daily_settings' existing UPDATE policy (tv_control_center.sql)
-- grants anon + authenticated blanket write access to the whole singleton row
-- — intentional for the no-login schedule picker, but that same openness
-- would let anyone hit PostgREST directly and set spotlight_active=true with
-- an arbitrary photo, or deface the kiosk with fake emergency text, with zero
-- auth — completely bypassing the PIN+device gate below and the "signed-in
-- admin" requirement on Emergency Push. RLS is row-level, not column-level,
-- so it can't express "these particular columns need stricter rules than the
-- rest of the row" — a BEFORE UPDATE trigger is the mechanism that can.
create or replace function public.tv_daily_settings_guard()
returns trigger language plpgsql as $$
begin
  -- Spotlight fields: service-role only. The push-tv-spotlight edge function
  -- (Luke-only, PIN + trusted-device verified) is the ONLY legitimate writer;
  -- no authenticated session, however privileged, may set these directly.
  if (new.spotlight_photo_url is distinct from old.spotlight_photo_url
      or new.spotlight_active  is distinct from old.spotlight_active
      or new.spotlight_set_at  is distinct from old.spotlight_set_at
      or new.spotlight_set_by  is distinct from old.spotlight_set_by)
     and auth.role() <> 'service_role' then
    raise exception 'spotlight fields are service-role only (push-tv-spotlight edge function)';
  end if;

  -- Emergency fields: any signed-in DISPATCH admin (s6 or s5), no PIN gate —
  -- matches the product decision. is_admin() reads auth.jwt() from the
  -- calling session, so this trigger must stay SECURITY INVOKER (the
  -- default) to see the real caller, not the function owner.
  if (new.emergency_active    is distinct from old.emergency_active
      or new.emergency_text      is distinct from old.emergency_text
      or new.emergency_header    is distinct from old.emergency_header
      or new.emergency_photo_url is distinct from old.emergency_photo_url
      or new.emergency_text_size is distinct from old.emergency_text_size)
     and not (auth.role() = 'service_role' or public.is_admin()) then
    raise exception 'emergency fields require an authenticated DISPATCH admin';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tv_daily_settings_guard on public.tv_daily_settings;
create trigger trg_tv_daily_settings_guard
  before update on public.tv_daily_settings
  for each row execute function public.tv_daily_settings_guard();

-- ── Trusted devices (Push-to-TV terminal binding, Luke only) ────────────────
create table if not exists public.trusted_devices (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  fingerprint  text not null,
  label        text,
  created_at   timestamptz not null default now(),
  unique (email, fingerprint)
);
create index if not exists trusted_devices_email_idx on public.trusted_devices(email);

alter table public.trusted_devices enable row level security;

drop policy if exists trusted_devices_select on public.trusted_devices;
drop policy if exists trusted_devices_delete on public.trusted_devices;

create policy trusted_devices_select on public.trusted_devices
  for select to authenticated using (public.is_luke() and lower(email) = lower(auth.jwt() ->> 'email'));

create policy trusted_devices_delete on public.trusted_devices
  for delete to authenticated using (public.is_luke() and lower(email) = lower(auth.jwt() ->> 'email'));

grant select, delete on public.trusted_devices to authenticated;
-- No insert/update policy — registration only happens through the
-- register-tv-terminal edge function (service role, PIN-verified).

-- ── Realtime publication ─────────────────────────────────────────────────────
-- PRE-EXISTING BUG, fixed here: tv_control_center.sql set up
-- useTvDailySettings.js's postgres_changes subscription and documented it as
-- "live-synced... no reload needed," but never actually added
-- tv_daily_settings to the supabase_realtime publication. A table's changes
-- are invisible to Realtime until explicitly added — the subscription was
-- always silently receiving nothing, for EVERY field on this row, not just
-- the new spotlight/emergency ones. This is why bottom-widget mode changes
-- also needed a manual reload. Fixing it here fixes all three at once —
-- bottom-widget, spotlight, and emergency all live on this one row.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tv_daily_settings'
  ) then
    alter publication supabase_realtime add table public.tv_daily_settings;
  end if;
end $$;

-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select spotlight_active, emergency_active from public.tv_daily_settings;
--   select * from public.trusted_devices; -- run as service role to see all
--   select * from pg_publication_tables where pubname='supabase_realtime' and tablename='tv_daily_settings';
-- ============================================================================
