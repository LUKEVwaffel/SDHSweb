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
drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
drop policy if exists push_subscriptions_admin_read on public.push_subscriptions;

-- Anyone can subscribe — same trust level as posting a parent photo (no login).
create policy push_subscriptions_insert on public.push_subscriptions
  for insert with check (true);

-- Unsubscribe. RLS cannot see the caller's device_fp (no auth) — same trust
-- model as rhea_photo_likes_delete, the client always scopes its own delete
-- to `.eq('device_fp', fp)`.
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete using (true);

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
