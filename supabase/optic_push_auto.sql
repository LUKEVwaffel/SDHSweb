-- ============================================================================
-- OPTIC push — AUTOMATIC photo-post alerts. Run in the Supabase SQL editor
-- (project bjgyvmdzcymruunzavni). Idempotent + additive.
--
-- Why: the 2026-09 Spring Hill survey round asked "did notifications fire?"
-- and 3/3 respondents (2 iPhone, 1 Android) said they turned notifications
-- on and never got one. Root cause wasn't the subscribe/deliver pipeline —
-- optic_push.sql + optic-send-push were both wired correctly — it's that
-- sending was 100% manual (LukePwa.jsx "SEND ALERT", see optic_push.sql).
-- Nobody has to remember to press a button anymore: this cron notices new
-- public photos on its own and fires the alert.
--
-- Depends on: optic_push.sql (push_subscriptions), photo_hub_v2.sql
-- (public.photos), optic-send-push edge fn (dual auth: a real admin JWT for
-- the manual "SEND ALERT" net-control button, OR this file's own dedicated
-- OPTIC_PUSH_CRON_SECRET for pg_net). pg_net + vault.decrypted_secrets
-- pattern borrowed from uniform_reminders.sql, but NOT the same secret —
-- found live 2026-09-19 that this project's edge runtime injects
-- SUPABASE_SERVICE_ROLE_KEY as the newer sb_secret_... key, not the legacy
-- JWT `service_role_key` in Vault holds, so a bearer-equality check against
-- it can never match (confirmed via a masked runtime diagnostic before
-- shipping this). Fix: a purpose-built secret instead of hoping a Supabase
-- platform key format lines up. One-time setup, already done for this
-- project — repeat only if OPTIC_PUSH_CRON_SECRET is ever rotated:
--   supabase secrets set OPTIC_PUSH_CRON_SECRET=<random 64-hex value>
--   select vault.create_secret('<same value>', 'optic_push_cron_secret');
--   supabase functions deploy optic-send-push --no-verify-jwt   (see that
--     file's own header — the platform's JWT gateway rejects a non-JWT
--     bearer before the function's own code ever runs, so this specific
--     function needs verify_jwt off; getCaller() inside it still does real
--     JWT validation by hand for the admin-JWT caller, same security either
--     way, just enforced in code instead of by the platform gateway).
--
-- Batching: photos land one at a time during active uploading, so this does
-- NOT fire per-photo (that would spam every subscribed device). It fires
-- once new photos exist AND the event has gone quiet for QUIET_MINUTES
-- (nothing new posted in that window) — same "wait for a lull" idea as the
-- realtime debounce already used client-side in useOpticPhotos.js, just at
-- cron granularity since a single DB trigger can't wait out a quiet period
-- on its own.
-- ============================================================================

create extension if not exists pg_net;

create table if not exists public.optic_push_notify_state (
  event_id          uuid primary key references public.events(id) on delete cascade,
  last_notified_at  timestamptz,
  updated_at        timestamptz not null default now()
);

create or replace function public.generate_optic_push_alerts()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fn_url      constant text := 'https://bjgyvmdzcymruunzavni.supabase.co/functions/v1/optic-send-push';
  v_quiet       constant interval := interval '2 minutes';
  v_cron_secret text;
  r             record;
  n             int := 0;
begin
  select decrypted_secret into v_cron_secret from vault.decrypted_secrets where name = 'optic_push_cron_secret';
  if v_cron_secret is null then
    raise notice 'optic_push_cron_secret not in Vault yet — see this file''s header. Skipping this run.';
    return 0;
  end if;

  for r in
    select p.event_id,
           count(*) filter (
             where p.created_at > coalesce(s.last_notified_at, 'epoch'::timestamptz)
           ) as new_count,
           max(p.created_at) as latest_at
      from public.photos p
      left join public.optic_push_notify_state s on s.event_id = p.event_id
     where p.event_id is not null
       and p.visibility = 'public' and p.status = 'live'
       and exists (select 1 from public.push_subscriptions ps where ps.event_id = p.event_id)
     group by p.event_id, s.last_notified_at
    having count(*) filter (
             where p.created_at > coalesce(s.last_notified_at, 'epoch'::timestamptz)
           ) > 0
       and max(p.created_at) <= now() - v_quiet
  loop
    -- Marked at queue time, not confirmed-delivery time — same tradeoff
    -- generate_uniform_reminders() already accepts (net.http_post is
    -- fire-and-forget async; plpgsql can't block on the response).
    insert into public.optic_push_notify_state (event_id, last_notified_at)
    values (r.event_id, r.latest_at)
    on conflict (event_id) do update set last_notified_at = excluded.last_notified_at, updated_at = now();

    perform net.http_post(
      url     := v_fn_url,
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_cron_secret, 'Content-Type', 'application/json'),
      body    := jsonb_build_object(
        'event_id', r.event_id,
        'title', 'OPTIC',
        'body', r.new_count || ' new photo' || (case when r.new_count = 1 then '' else 's' end) || ' just posted from the comp.'
      )
    );
    n := n + 1;
  end loop;

  return n;
end;
$$;

-- Same lockdown as generate_uniform_reminders()/generate_opticsend_drafts():
-- cron fires as `postgres` (already bypasses RLS); this just stops an
-- anon/authenticated caller from invoking it directly via PostgREST.
revoke execute on function public.generate_optic_push_alerts() from public;
revoke all     on function public.generate_optic_push_alerts() from anon, authenticated;

alter table public.optic_push_notify_state enable row level security;
select public._drop_all_policies('optic_push_notify_state');
create policy optic_push_notify_state_read_admin on public.optic_push_notify_state
  for select to authenticated using (public.is_admin());

do $$ begin perform cron.unschedule('optic-push-auto'); exception when others then null; end $$;
select cron.schedule('optic-push-auto', '*/2 * * * *', $$select public.generate_optic_push_alerts()$$);

-- ============================================================================
-- Done. Requires optic-send-push already deployed --no-verify-jwt with
-- OPTIC_PUSH_CRON_SECRET set (see this file's header) — already done for
-- this project as of 2026-09-19.
--
-- Verify:
--   select * from cron.job where jobname = 'optic-push-auto';
--   select public.generate_optic_push_alerts();  -- manual dry run, returns count queued
--   select * from public.optic_push_notify_state order by updated_at desc;
-- ============================================================================
