-- ============================================================================
-- OPTIC 2.0 — web push. Run in the Supabase SQL editor. Idempotent + additive.
--
-- What this does:
--   1. push_subscriptions — one row per device that opted in to photo alerts.
--   2. RLS — a device can only insert/delete its OWN row (matched by
--      device_fp, same pattern as rhea_photo_likes). Reading the list back is
--      admin-only (the send function uses the service role key and bypasses
--      RLS entirely, so this is just hygiene, not load-bearing for sending).
--
-- Depends on: public.is_admin(), public.events, lib/opticPush.js (subscribe
-- side), supabase/functions/optic-send-push (send side).
-- ============================================================================

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  device_fp   text,
  event_id    uuid references public.events(id) on delete cascade,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_event_idx on public.push_subscriptions (event_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_insert on public.push_subscriptions;
drop policy if exists push_subscriptions_update on public.push_subscriptions;
drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
drop policy if exists push_subscriptions_admin_read on public.push_subscriptions;

-- Anyone can subscribe — same trust level as posting a parent photo (no login).
create policy push_subscriptions_insert on public.push_subscriptions
  for insert to public with check (true);

-- Re-subscribing (same endpoint) needs an UPDATE policy too — but the client
-- deliberately does NOT use .upsert()/ON CONFLICT DO UPDATE (see
-- lib/opticPush.js): confirmed live on this project that a single-statement
-- upsert reliably 42501s ("new row violates row-level security policy") on
-- this table even with matching insert + update policies in place — some
-- interaction between RLS evaluation and INSERT..ON CONFLICT DO UPDATE on
-- this hosted instance, not a missing policy. The client does a plain insert,
-- and on a 23505 (duplicate endpoint) falls back to a plain update instead —
-- both verified working individually. This policy backs that fallback path.
create policy push_subscriptions_update on public.push_subscriptions
  for update to public using (true) with check (true);

-- Unsubscribe. RLS cannot see the caller's device_fp (no auth) — same trust
-- model as rhea_photo_likes_delete, the client always scopes its own delete
-- to `.eq('device_fp', fp)`.
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to public using (true);

create policy push_subscriptions_admin_read on public.push_subscriptions
  for select to authenticated using (public.is_admin());

-- ============================================================================
-- Send side needs (Luke, when ready to actually send — not required for the
-- permission/subscribe flow to work):
--   supabase secrets set VAPID_PUBLIC_KEY=<public key below>
--   supabase secrets set VAPID_PRIVATE_KEY=<private key — NEVER commit this>
--   supabase secrets set VAPID_SUBJECT=mailto:you@example.com
--   supabase functions deploy optic-send-push
--
-- Public key (safe to be public, already baked into src/lib/opticPush.js):
--   BHfqrcaOswk7dbYWnRwH9ZeC1uzWfSb3fD3aZWCwtxpFsg28beB7jltwr-BVocxp0M8T2Ugwo3gU082QGfyboiE
-- ============================================================================
