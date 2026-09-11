-- Enables Supabase Realtime on ball_signups + ball_guests so the dress
-- (/ball/dress) and male-guest attire (/ball/attire) portals live-refresh
-- when another approver (or the guest-verify flow) changes a row, instead
-- of only updating on manual "Refresh". RLS still applies to what each
-- portal's subscription can see.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ball_signups'
  ) then
    alter publication supabase_realtime add table public.ball_signups;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ball_guests'
  ) then
    alter publication supabase_realtime add table public.ball_guests;
  end if;
end $$;

-- VERIFY AFTER RUNNING:
--   select * from pg_publication_tables where pubname='supabase_realtime' and tablename in ('ball_signups','ball_guests');
