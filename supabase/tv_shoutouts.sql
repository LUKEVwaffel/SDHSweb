-- ============================================================================
-- TV SHOUTOUTS — birthday + manual recognition widget for the /tv kiosk. Run
-- AFTER tv_broadcast.sql (this file replaces public.tv_daily_settings_guard(),
-- adding a third guarded block alongside its existing spotlight/emergency
-- ones) and AFTER admin_roles.sql (relies on cadet_consent already being
-- LOCKED to authenticated s6, SECTION 3d there). Run in the Supabase SQL
-- editor. Idempotent.
--
-- DESIGN — two very different trust levels for one on-screen widget:
--
--   BIRTHDAY (auto): sourced from cadet_consent.birthdate, which is minors'
--   PII. cadet_consent is already authenticated-s6-only (no anon access at
--   all, admin_roles.sql SECTION 3d) — adding `birthdate` there needs zero
--   new access-control work. But /tv itself reads tv_daily_settings over the
--   PUBLIC ANON KEY with no login (useTvDailySettings.js) and must never
--   query cadet_consent directly. So the birthdate itself never crosses that
--   boundary — only a derived, non-reversible daily fact (name + computed
--   age + tag) does, written by compute_daily_birthday_shoutout() below.
--   That function is SECURITY DEFINER (owned by postgres, same as
--   generate_opticsend_drafts() in opticsend.sql) and is the ONLY legitimate
--   writer of the shoutout_bday_* columns — enforced the same way
--   tv_broadcast.sql already enforces spotlight_* being service-role-only: a
--   BEFORE UPDATE trigger, because RLS is row-level and can't express
--   "these particular columns need stricter rules than the rest of the row."
--
--   MANUAL (staff-typed recognitions — attendance, honors, etc.): no PII,
--   staff types it themselves via the control center, same trust level as
--   the existing custom_message field. No extra gate — falls through to
--   tv_daily_settings' existing blanket anon+authenticated UPDATE policy.
-- ============================================================================

-- ── cadet_consent: add birthdate (table is already s6-only, see header) ─────
alter table public.cadet_consent
  add column if not exists birthdate date;

-- ── tv_daily_settings: shoutout columns ──────────────────────────────────────
alter table public.tv_daily_settings
  add column if not exists shoutout_bday_name    text,
  add column if not exists shoutout_bday_tag     text not null default 'BIRTHDAY',
  add column if not exists shoutout_bday_note    text,
  add column if not exists shoutout_bday_set_at  timestamptz,
  add column if not exists shoutout_manual_name    text,
  add column if not exists shoutout_manual_tag     text,
  add column if not exists shoutout_manual_note    text,
  add column if not exists shoutout_manual_set_at  timestamptz;

-- ── Touch trigger: stamp shoutout_manual_set_at only when its own fields
-- actually change (client never sends this timestamp itself) — same
-- conditional shape tv_control_center.sql's tv_daily_settings_touch() already
-- uses for mode_set_at, extended with a matching block rather than a new
-- trigger, since both live on the same BEFORE UPDATE pass.
create or replace function public.tv_daily_settings_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if (new.bottom_widget_mode is distinct from old.bottom_widget_mode)
     or (new.custom_message is distinct from old.custom_message)
     or (new.custom_signoff is distinct from old.custom_signoff) then
    new.mode_set_at := now();
  end if;
  if (new.shoutout_manual_name is distinct from old.shoutout_manual_name)
     or (new.shoutout_manual_tag  is distinct from old.shoutout_manual_tag)
     or (new.shoutout_manual_note is distinct from old.shoutout_manual_note) then
    new.shoutout_manual_set_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tv_daily_settings_touch on public.tv_daily_settings;
create trigger trg_tv_daily_settings_touch
  before update on public.tv_daily_settings
  for each row execute function public.tv_daily_settings_touch();

-- ── Guard trigger: extend tv_daily_settings_guard() with a 3rd block ────────
-- Re-declares the FULL function (spotlight + emergency blocks unchanged,
-- verbatim from tv_broadcast.sql) plus the new birthday-shoutout block, so
-- this file can be re-run safely without needing tv_broadcast.sql present in
-- the same session. SECURITY INVOKER (the default) — must stay that way so
-- auth.role()/is_admin() see the real calling session, not the function owner.
create or replace function public.tv_daily_settings_guard()
returns trigger language plpgsql as $$
begin
  -- Spotlight fields: service-role only (push-tv-spotlight edge function).
  if (new.spotlight_photo_url is distinct from old.spotlight_photo_url
      or new.spotlight_active  is distinct from old.spotlight_active
      or new.spotlight_set_at  is distinct from old.spotlight_set_at
      or new.spotlight_set_by  is distinct from old.spotlight_set_by)
     and auth.role() <> 'service_role' then
    raise exception 'spotlight fields are service-role only (push-tv-spotlight edge function)';
  end if;

  -- Emergency fields: any signed-in DISPATCH admin (s6 or s5), no PIN gate.
  if (new.emergency_active    is distinct from old.emergency_active
      or new.emergency_text      is distinct from old.emergency_text
      or new.emergency_header    is distinct from old.emergency_header
      or new.emergency_photo_url is distinct from old.emergency_photo_url
      or new.emergency_text_size is distinct from old.emergency_text_size)
     and not (auth.role() = 'service_role' or public.is_admin()) then
    raise exception 'emergency fields require an authenticated DISPATCH admin';
  end if;

  -- Birthday shoutout fields: service-role only. compute_daily_birthday_shoutout()
  -- (below) is the ONLY legitimate writer — no authenticated session, however
  -- privileged, may set these directly; they're derived from cadet_consent.birthdate,
  -- which no web session (anon or authenticated-non-s6) can read in the first place.
  if (new.shoutout_bday_name   is distinct from old.shoutout_bday_name
      or new.shoutout_bday_tag    is distinct from old.shoutout_bday_tag
      or new.shoutout_bday_note   is distinct from old.shoutout_bday_note
      or new.shoutout_bday_set_at is distinct from old.shoutout_bday_set_at)
     and auth.role() <> 'service_role' then
    raise exception 'birthday shoutout fields are service-role only (compute_daily_birthday_shoutout)';
  end if;

  return new;
end;
$$;

-- Trigger itself already exists (tv_broadcast.sql created it pointing at this
-- function); no need to re-create — CREATE OR REPLACE FUNCTION above is
-- enough for the new body to take effect. Re-declared here anyway so this
-- file is fully self-sufficient if run standalone.
drop trigger if exists trg_tv_daily_settings_guard on public.tv_daily_settings;
create trigger trg_tv_daily_settings_guard
  before update on public.tv_daily_settings
  for each row execute function public.tv_daily_settings_guard();

-- ── Daily computation: who has a birthday today? ─────────────────────────────
-- SECURITY DEFINER, owned by postgres (same posture as
-- generate_opticsend_drafts() in opticsend.sql) — reads cadet_consent.birthdate
-- (a table no web session, anon or authenticated-non-s6, can read) and writes
-- only the derived public-safe fact. Picks the first match (alphabetical via
-- sort_order/name) when multiple cadets share a birthday — rotating between
-- same-day birthdays is a future enhancement, not needed for v1.
create or replace function public.compute_daily_birthday_shoutout()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_birthdate date;
  v_years int;
begin
  select name, birthdate into v_name, v_birthdate
  from public.cadet_consent
  where birthdate is not null
    and to_char(birthdate, 'MM-DD') = to_char((now() at time zone 'America/New_York')::date, 'MM-DD')
  order by sort_order, name
  limit 1;

  if v_name is null then
    update public.tv_daily_settings set
      shoutout_bday_name   = null,
      shoutout_bday_note   = null,
      shoutout_bday_set_at = now()
    where id = 'default';
    return;
  end if;

  v_years := extract(year from age((now() at time zone 'America/New_York')::date, v_birthdate));

  update public.tv_daily_settings set
    shoutout_bday_name   = v_name,
    shoutout_bday_tag     = 'BIRTHDAY',
    shoutout_bday_note   = 'Turning ' || v_years || ' today',
    shoutout_bday_set_at = now()
  where id = 'default';
end;
$$;

-- ── Schedule: once daily, ~5-6am NY (10:00 UTC) ──────────────────────────────
-- Same idempotent unschedule-then-reschedule idiom as opticsend.sql. A few
-- hours of DST drift across the year is harmless for this use case, same
-- rationale documented there.
create extension if not exists pg_cron;
do $$ begin perform cron.unschedule('tv-birthday-shoutout-daily'); exception when others then null; end $$;
select cron.schedule('tv-birthday-shoutout-daily', '0 10 * * *', $$select public.compute_daily_birthday_shoutout()$$);

-- ============================================================================
-- VERIFY AFTER RUNNING:
--   -- 1. Manually test the computation (safe to run any time, idempotent):
--   update public.cadet_consent set birthdate = (now() at time zone 'America/New_York')::date
--     where id = (select id from public.cadet_consent limit 1);
--   select public.compute_daily_birthday_shoutout();
--   select shoutout_bday_name, shoutout_bday_note, shoutout_bday_set_at from public.tv_daily_settings;
--
--   -- 2. Confirm the guard actually blocks a direct write (run as the anon/
--   --    authenticated role via PostgREST or the browser console, NOT the SQL
--   --    editor — the SQL editor runs as postgres and bypasses the trigger's
--   --    auth.role() check by design, same as any other service-role write):
--   --    expect: "birthday shoutout fields are service-role only ..."
--
--   -- 3. Confirm the cron job is registered:
--   select jobname, schedule from cron.job where jobname = 'tv-birthday-shoutout-daily';
-- ============================================================================
