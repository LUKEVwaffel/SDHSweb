-- ============================================================================
-- MILITARY BALL — split friend's own cash payment from the host's. Independent
-- add-on (like ball_ops_dress_views_fix.sql) — run any time after
-- ball_guest_model.sql. Idempotent. Run in the Supabase SQL editor (project
-- bjgyvmdzcymruunzavni).
--
-- WHY: a 'friend' guest with friend_payment_method='self_pays' hands their own
-- $35 to the school separately from the host's payment — two distinct
-- handoffs, tracked in ball_ops_dress_views_fix's language as two "tickets".
-- 'host_delivers' (or any 'date' guest, couple rate) is still one handoff —
-- the host's existing cash_received toggle covers it. Kaz/Chief need a SECOND
-- toggle only for the self_pays case.
--
-- AFTER RUNNING THIS FILE, RE-RUN ball_guards.sql (bumped to v6 with a
-- reviewer branch on ball_guests_column_guard for friend_cash_received) — see
-- that file's own header. Order between the two does not matter; the guard's
-- NEW.friend_cash_received reference resolves at trigger-fire time.
-- ============================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ball_guests' and column_name = 'friend_payment_method') then
    raise exception 'ball_guest_cash_split.sql: run ball_guest_model.sql first (ball_guests.friend_payment_method missing)';
  end if;
end $$;

alter table public.ball_guests
  add column if not exists friend_cash_received boolean not null default false;

-- Widen the ops view Kaz/Chief read from (ball_guest_model.sql SECTION 4).
drop view if exists public.ball_guests_ops_view;
create view public.ball_guests_ops_view
with (security_barrier = true) as
  select id, signup_id, name, age, guest_type, is_sdhs_jrotc, school_attended,
         friend_payment_method, friend_amount_due, friend_cash_received
  from public.ball_guests
  where public.is_reviewer();
grant select on public.ball_guests_ops_view to authenticated;

-- ============================================================================
-- VERIFY AFTER RUNNING (then after re-running ball_guards.sql v6):
--   select column_name from information_schema.columns
--     where table_name='ball_guests' and column_name='friend_cash_received';  -- 1 row
--   select * from public.ball_guests_ops_view limit 1;   -- has friend_cash_received
--   -- as an ops (reviewer) session, after ball_guards.sql v6:
--   --   update ball_guests set friend_cash_received = true where id = '<guest row>'; -- OK
--   --   update ball_guests set friend_amount_due = 0        where id = '<guest row>'; -- raises
-- ============================================================================
