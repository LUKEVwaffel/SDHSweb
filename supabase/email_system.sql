-- ============================================================================
-- EMAIL LIST SYSTEM — subscribers + messages with a physical-signature gate.
-- Run in the Supabase SQL editor (project bjgyvmdzcymruunzavni). Idempotent.
--
-- Flow: draft → pending_signature (printed) → signed (SAI/1SG wet signature,
-- admin marks it) → sent (Resend edge function fires). A message CANNOT be sent
-- until status='signed'; the send edge function re-checks this server-side.
--
-- PRIVACY / TRUST: same posture as the rest of the app (anon key + passcode
-- admin). Subscriber emails are readable with the public anon key. If that
-- matters, move email_* behind real Supabase Auth. Flagged deliberately.
-- ============================================================================

create extension if not exists pgcrypto;

-- Subscribers: plain emails, NOT accounts. No auth per subscriber.
create table if not exists public.email_subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  name        text,
  company     text,                        -- optional tag: alpha/bravo/... or null
  source      text not null default 'signup' check (source in ('signup','manual')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists email_subscribers_active_idx on public.email_subscribers(active, created_at desc);

-- Messages: the email + its signature gate + send audit.
create table if not exists public.email_messages (
  id               uuid primary key default gen_random_uuid(),
  subject          text not null,
  body             text not null,
  status           text not null default 'draft'
                     check (status in ('draft','pending_signature','signed','sent')),
  pdf_generated_at timestamptz,
  signed_by        text,                   -- adminId who marked it signed
  signed_at        timestamptz,
  sent_at          timestamptz,
  recipient_count  int,
  send_error       text,
  created_by       text,
  created_at       timestamptz not null default now()
);
create index if not exists email_messages_status_idx on public.email_messages(status, created_at desc);

-- RLS — matches existing anon-key admin pattern. The send gate is enforced by
-- the edge function (service role re-checks status='signed'), not by RLS.
alter table public.email_subscribers enable row level security;
alter table public.email_messages    enable row level security;

drop policy if exists email_subscribers_read  on public.email_subscribers;
drop policy if exists email_subscribers_write on public.email_subscribers;
-- Public INSERT is allowed so the site signup form can add subscribers with the
-- anon key. Read/update/delete also open (admin), consistent with app posture.
create policy email_subscribers_read  on public.email_subscribers for select using (true);
create policy email_subscribers_write on public.email_subscribers for all    using (true) with check (true);

drop policy if exists email_messages_read  on public.email_messages;
drop policy if exists email_messages_write on public.email_messages;
create policy email_messages_read  on public.email_messages for select using (true);
create policy email_messages_write on public.email_messages for all    using (true) with check (true);

-- ============================================================================
-- Edge function `send-email` needs the Resend key as a secret (NOT in .env):
--   supabase secrets set RESEND_API_KEY=your_key_here
-- Deploy:   supabase functions deploy send-email
-- ============================================================================
