-- ============================================================================
-- IRONCLAD UNIFORM REMINDERS — fully automated, no admin click, no review.
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
-- Depends on: events_calendar.sql (events.category/status), admin_roles.sql
-- (is_admin()), cadet_consent_contact.sql (school_email), photo_hub_v2.sql
-- (pg_cron already enabled by that migration).
--
-- WHAT THIS ADDS:
--   • events.uniform_reminder_exempt — per-event opt-out, for a Thursday
--     uniform day that gets canceled/modified after being posted.
--   • uniform_reminder_log — idempotency marker (event_id, offset_label),
--     same role as opticsend_drafts — a cron re-run can never double-send.
--   • generate_uniform_reminders() — scans for UNIFORM_DAY events dated
--     exactly 3 days out (today=Monday) or 1 day out (today=Wednesday),
--     and actually SENDS via pg_net → the send-uniform-reminders edge
--     function (unlike OpticSend, which only leaves a draft for a human —
--     these have no review step, per spec: "ironclad, no excuses").
--   • daily cron trigger.
--
-- pg_net's net.http_post is fire-and-forget async — plpgsql can't block on
-- the HTTP response, so uniform_reminder_log is marked at QUEUE time, not
-- confirmed-delivery time. Same tradeoff generate_opticsend_drafts() already
-- accepts for its idempotency marker.
--
-- ⚠ MANUAL STEP REQUIRED BEFORE THIS WORKS — run once, separately, with your
-- REAL service_role key (Project Settings → API → service_role). NEVER put
-- the actual key in this file / commit it:
--
--   select vault.create_secret('<paste service_role key here>', 'service_role_key');
--
-- net.http_post authenticates to the edge function using that key (pulled
-- from Vault at call time, never stored in plain SQL) — the edge function
-- deploys WITH jwt verification (default), and a service-role bearer token
-- is itself a valid Supabase JWT, so it passes that gate cleanly.
-- ============================================================================

create extension if not exists pg_net;

alter table public.events
  add column if not exists uniform_reminder_exempt boolean not null default false;

create table if not exists public.uniform_reminder_log (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  offset_label text not null check (offset_label in ('monday', 'wednesday')),
  sent_at      timestamptz not null default now(),
  unique (event_id, offset_label)
);

create or replace function public.generate_uniform_reminders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fn_url     constant text := 'https://bjgyvmdzcymruunzavni.supabase.co/functions/v1/send-uniform-reminders';
  v_svc_key    text;
  r            record;
  n            int := 0;
begin
  select decrypted_secret into v_svc_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_svc_key is null then
    raise notice 'service_role_key not in Vault yet — see header comment. Skipping this run.';
    return 0;
  end if;

  for r in
    select e.id, 'monday'::text as offset_label
      from public.events e
     where e.category = 'UNIFORM_DAY' and e.status = 'posted' and not e.uniform_reminder_exempt
       and e.date = (current_date + 3) and extract(dow from e.date) = 4
       and not exists (select 1 from public.uniform_reminder_log l where l.event_id = e.id and l.offset_label = 'monday')
    union all
    select e.id, 'wednesday'::text
      from public.events e
     where e.category = 'UNIFORM_DAY' and e.status = 'posted' and not e.uniform_reminder_exempt
       and e.date = (current_date + 1) and extract(dow from e.date) = 4
       and not exists (select 1 from public.uniform_reminder_log l where l.event_id = e.id and l.offset_label = 'wednesday')
  loop
    insert into public.uniform_reminder_log (event_id, offset_label) values (r.id, r.offset_label);

    perform net.http_post(
      url     := v_fn_url,
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_svc_key, 'Content-Type', 'application/json'),
      body    := jsonb_build_object('event_id', r.id, 'offset', r.offset_label)
    );
    n := n + 1;
  end loop;

  return n;
end;
$$;

-- Same lockdown as generate_opticsend_drafts() — cron fires as `postgres`
-- (bypasses RLS already); this just stops an anon/authenticated caller from
-- invoking it directly via PostgREST ahead of schedule.
revoke execute on function public.generate_uniform_reminders() from public;
revoke all     on function public.generate_uniform_reminders() from anon, authenticated;

alter table public.uniform_reminder_log enable row level security;
select public._drop_all_policies('uniform_reminder_log');
create policy uniform_reminder_log_read_admin on public.uniform_reminder_log
  for select to authenticated using (public.is_admin());

do $$ begin perform cron.unschedule('uniform-reminders-daily'); exception when others then null; end $$;
select cron.schedule('uniform-reminders-daily', '0 13 * * *', $$select public.generate_uniform_reminders()$$);

-- ============================================================================
-- Done. Verify (after running vault.create_secret above):
--   select * from cron.job where jobname = 'uniform-reminders-daily';
--   select public.generate_uniform_reminders();  -- manual dry run, returns count
-- ============================================================================
