-- Texas Roadhouse roll counter — sign up with a name, tap to count your rolls,
-- everyone sees everyone's live count. Anon read/write (fun/low-stakes, no auth).

create table if not exists roll_counter_entries (
  id uuid primary key default gen_random_uuid(),
  event text not null default 'texas-roadhouse-2026-09-19',
  name text not null check (char_length(trim(name)) between 1 and 30),
  count integer not null default 0 check (count >= 0 and count <= 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists roll_counter_entries_event_idx on roll_counter_entries (event);

alter table roll_counter_entries enable row level security;

drop policy if exists "roll_counter_select_all" on roll_counter_entries;
create policy "roll_counter_select_all" on roll_counter_entries
  for select using (true);

drop policy if exists "roll_counter_insert_all" on roll_counter_entries;
create policy "roll_counter_insert_all" on roll_counter_entries
  for insert with check (true);

drop policy if exists "roll_counter_update_all" on roll_counter_entries;
create policy "roll_counter_update_all" on roll_counter_entries
  for update using (true) with check (true);

create or replace function roll_counter_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists roll_counter_touch on roll_counter_entries;
create trigger roll_counter_touch
  before update on roll_counter_entries
  for each row execute function roll_counter_set_updated_at();

-- Live updates for the group leaderboard.
alter publication supabase_realtime add table roll_counter_entries;
