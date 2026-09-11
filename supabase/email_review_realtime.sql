-- Enables Supabase Realtime on email_messages so the reviewer portal
-- (/review — Kaz/Chief) and Ball Ops (/ball/ops, same account) live-refresh
-- when a draft is submitted for review, decided by a fellow reviewer, or
-- sent, instead of only updating on manual "Refresh". RLS still applies to
-- what each portal's subscription can see.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'email_messages'
  ) then
    alter publication supabase_realtime add table public.email_messages;
  end if;
end $$;

-- VERIFY AFTER RUNNING:
--   select * from pg_publication_tables where pubname='supabase_realtime' and tablename='email_messages';
