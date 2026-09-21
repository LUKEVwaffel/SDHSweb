-- ============================================================================
-- CLIENT ERROR TRACKING — every failure a Ball dress/attire/payment reviewer
-- can hit gets logged with a stable, human-readable CODE (see
-- src/lib/errorCodes.js for the registry) plus full detail. Run in the
-- Supabase SQL editor (project bjgyvmdzcymruunzavni), idempotent.
--
-- WHY: reviewers reported vague "it didn't work" with no way to trace which
-- write failed, for whom, or why. Now every surfaced error also shows a code
-- like BALL-OPS-020 — a reviewer reads that off screen, Luke greps it here:
--   select * from public.app_error_log where code = 'BALL-OPS-020' order by created_at desc limit 20;
--
-- Logging goes through log_client_error() (SECURITY DEFINER), never a raw
-- table INSERT grant — user_email is pulled server-side from the JWT so a
-- caller can't spoof who hit the error, and the function is the only way in
-- for anon/authenticated, so no policy needs to trust client-supplied identity.
-- ============================================================================

create table if not exists public.app_error_log (
  id bigint generated always as identity primary key,
  code text not null,
  portal text not null,
  message text not null,
  detail jsonb,
  context jsonb,
  user_email text,
  created_at timestamptz not null default now()
);

create index if not exists app_error_log_code_idx on public.app_error_log (code);
create index if not exists app_error_log_created_at_idx on public.app_error_log (created_at desc);
create index if not exists app_error_log_portal_idx on public.app_error_log (portal);

alter table public.app_error_log enable row level security;

-- No direct INSERT/SELECT grants to anon/authenticated — everything goes
-- through log_client_error() (write) and is_s6() (read) below.
revoke all on public.app_error_log from public, anon, authenticated;

drop policy if exists app_error_log_read_s6 on public.app_error_log;
create policy app_error_log_read_s6 on public.app_error_log
  for select to authenticated
  using (public.is_s6());

grant select on public.app_error_log to authenticated;


-- ── log_client_error() — the only way to write a row ───────────────────────
-- p_code / p_portal / p_message are short, deliberate strings the calling
-- component already knows (see errorCodes.js). p_detail/p_context are
-- free-form jsonb for whatever's useful to debug (row id, field, table,
-- raw error message/stack). message is truncated defensively — this is a
-- log table, not a place for an attacker to dump megabytes.
create or replace function public.log_client_error(
  p_code text,
  p_portal text,
  p_message text,
  p_detail jsonb default null,
  p_context jsonb default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_error_log (code, portal, message, detail, context, user_email)
  values (
    left(coalesce(p_code, 'UNKNOWN'), 64),
    left(coalesce(p_portal, 'unknown'), 64),
    left(coalesce(p_message, ''), 2000),
    p_detail,
    p_context,
    lower(auth.jwt() ->> 'email')
  );
end;
$$;

revoke all on function public.log_client_error(text, text, text, jsonb, jsonb) from public;
grant execute on function public.log_client_error(text, text, text, jsonb, jsonb) to anon, authenticated;

-- ============================================================================
-- VERIFY AFTER RUNNING:
--   select public.log_client_error('TEST-001', 'test', 'hello world');
--   select * from public.app_error_log order by created_at desc limit 1;
--   -- as a non-S6 authenticated user: select * from public.app_error_log;  -- 0 rows
-- LOOKUP (what you'll actually run when someone reports a code):
--   select code, portal, message, detail, context, user_email, created_at
--   from public.app_error_log
--   where code = 'BALL-OPS-020'
--   order by created_at desc
--   limit 20;
-- ============================================================================
