-- ============================================================================
-- GUARD ALERTS — one-click cadet notification when a Color/Honor Guard
-- roster is set. Run in the Supabase SQL editor. Idempotent.
-- Depends on: events_color_guard.sql (event_color_guard/event_honor_guard,
-- is_admin()/is_s5()/is_s6()), cadet_consent_contact.sql (school_email).
--
-- WHAT THIS ADDS:
--   • events.color_guard_notes / honor_guard_notes — optional freeform
--     directions the roster drafter can write, included verbatim in the
--     alert email. Plain columns like description/transportation, not a
--     sync table — see EventsPanel.jsx.
--   • guard_alert_log — one row per "ALERT COLOR/HONOR GUARD" click. Doubles
--     as the audit trail (who alerted, who was notified, who was told
--     they'd been removed) and as the diff baseline for the next click.
--
-- Sending itself happens in supabase/functions/send-guard-alert (service
-- role, bypasses this table's RLS) — no review gate, same posture as the
-- existing in-app message notifications (notify-new-message).
-- ============================================================================

alter table public.events
  add column if not exists color_guard_notes text,
  add column if not exists honor_guard_notes text;

create table if not exists public.guard_alert_log (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  guard_type    text not null check (guard_type in ('color', 'honor')),
  sent_by       text not null,
  sent_at       timestamptz not null default now(),
  recipient_ids uuid[] not null default '{}',   -- cadet_consent_ids notified this send
  removed_ids   uuid[] not null default '{}',   -- cadet_consent_ids told they were removed
  recipient_count int not null default 0,
  removed_count   int not null default 0
);
create index if not exists guard_alert_log_event_idx on public.guard_alert_log(event_id, guard_type, sent_at desc);

-- RLS: admin-read only (internal duty-roster audit trail, not public). No
-- client write policy at all — only send-guard-alert's service-role client
-- inserts, same posture as opticsend_drafts.
alter table public.guard_alert_log enable row level security;
select public._drop_all_policies('guard_alert_log');
create policy guard_alert_log_read_admin on public.guard_alert_log
  for select to authenticated using (public.is_admin());
