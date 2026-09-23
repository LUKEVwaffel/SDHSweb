-- ============================================================================
-- INBOUND EMAIL — replies to outbound Resend mail land here.
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
--
-- Resend can receive mail on a verified sending domain and forward each
-- message to a webhook as an `email.received` event. This table is the
-- landing spot; supabase/functions/resend-inbound-webhook writes to it with
-- the service role key (RLS below only governs the anon-key admin read/UI
-- path, same open posture as email_system.sql).
--
-- ONE-TIME SETUP IN RESEND DASHBOARD (not done by this file or by Claude):
--   1. Domains → your sending domain → enable "Receiving" → add the MX
--      record it gives you (alongside the existing SPF/DKIM records).
--   2. Webhooks → Add Webhook → URL = the deployed function URL:
--        https://<project-ref>.supabase.co/functions/v1/resend-inbound-webhook
--      Event: email.received. Copy the signing secret it shows once.
--   3. supabase secrets set RESEND_WEBHOOK_SECRET=whsec_...
--   4. supabase functions deploy resend-inbound-webhook --no-verify-jwt
--      (Resend calls this anonymously and authenticates via the Svix
--      signature instead of a Supabase JWT.)
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.email_replies (
  id                 uuid primary key default gen_random_uuid(),
  resend_email_id    text unique,              -- Resend's event id, dedupes retried webhook deliveries
  from_address       text not null,
  from_name          text,
  to_address         text,
  subject            text,
  text_body          text,
  html_body          text,
  in_reply_to        text,                      -- In-Reply-To header, if present
  received_at        timestamptz not null default now(),
  read_at            timestamptz,
  raw                jsonb                      -- full webhook payload, for anything the UI doesn't surface yet
);
create index if not exists email_replies_received_idx on public.email_replies(received_at desc);
create index if not exists email_replies_unread_idx on public.email_replies(read_at) where read_at is null;

-- RLS — same anon-key admin posture as email_system.sql. Inserts only ever
-- happen from the webhook via the service role, which bypasses RLS, so no
-- insert policy is needed (and none is granted to anon/authenticated).
alter table public.email_replies enable row level security;

drop policy if exists email_replies_read   on public.email_replies;
drop policy if exists email_replies_update on public.email_replies;
create policy email_replies_read   on public.email_replies for select using (true);
create policy email_replies_update on public.email_replies for update using (true) with check (true); -- mark-as-read only, from the admin panel
