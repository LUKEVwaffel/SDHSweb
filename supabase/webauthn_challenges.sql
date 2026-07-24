-- ============================================================================
-- WEBAUTHN CHALLENGE STORE — for the passkey (Touch ID) login/registration.
-- Run in the Supabase SQL editor. Idempotent. Depends on admin_roles.sql.
--
-- WebAuthn is a challenge/response protocol: the server issues a random
-- challenge, the authenticator signs it, the server verifies the signature
-- against the stored public key. The challenge must be kept server-side between
-- the "options" and "verify" round-trips. Login happens PRE-session, so the
-- challenge can't live in a user session — it's keyed by email here.
--
-- SECURITY: service_role only. A challenge is single-use (the edge function
-- deletes it on consume) and short-lived (expires_at, ~5 min). No client can
-- read or write this table — RLS is enabled with no policies AND the Supabase
-- default grant is revoked (defense in depth, same posture as account_credentials).
-- ============================================================================

create table if not exists public.webauthn_challenges (
  email      text not null references public.admin_roles(email) on delete cascade,
  kind       text not null check (kind in ('register','login')),
  challenge  text not null,                        -- base64url, as issued by the lib
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  -- Composite key: register and login challenges for the same account are
  -- separate rows, so a pre-auth login-start can't overwrite an in-flight
  -- register challenge (or vice-versa).
  primary key (email, kind)
);

alter table public.webauthn_challenges enable row level security;
-- (intentionally no policies — service_role only)
revoke all on public.webauthn_challenges from anon, authenticated;

-- VERIFY:
--   select has_table_privilege('anon','webauthn_challenges','select');          -- false
--   select has_table_privilege('authenticated','webauthn_challenges','select'); -- false
