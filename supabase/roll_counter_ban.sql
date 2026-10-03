-- Breadstick / roll counter permanent name bans.
-- The counter is anon read/write, so the ban has to live in the database:
-- a trigger rejects any insert or rename whose normalized name contains a
-- banned term. Normalizing (lowercase, common leetspeak swaps, strip
-- everything but letters) keeps "C0ck_Master 6000" from slipping through.
-- Banned terms live in a table anon can't read or write; add rows to ban more.

create table if not exists roll_counter_banned_names (
  term text primary key check (term = lower(term) and term ~ '^[a-z]+$'),
  reason text,
  created_at timestamptz not null default now()
);

alter table roll_counter_banned_names enable row level security;
-- No policies: anon/authenticated get nothing. The trigger below reads it as
-- security definer.

insert into roll_counter_banned_names (term, reason)
values ('cockmaster', 'Perma ban: cockmaster6000')
on conflict (term) do nothing;

create or replace function roll_counter_normalize_name(raw text)
returns text language sql immutable as $$
  select regexp_replace(
    translate(lower(coalesce(raw, '')), '013457@$!|', 'oieastasii'),
    '[^a-z]', '', 'g'
  );
$$;

create or replace function roll_counter_reject_banned()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from roll_counter_banned_names b
    where position(b.term in roll_counter_normalize_name(new.name)) > 0
  ) then
    raise exception 'banned' using errcode = 'P0001', hint = 'roll_counter_banned';
  end if;
  return new;
end;
$$;

drop trigger if exists roll_counter_ban_guard on roll_counter_entries;
create trigger roll_counter_ban_guard
  before insert or update of name on roll_counter_entries
  for each row execute function roll_counter_reject_banned();

-- Remove any existing banned entries from every leaderboard.
delete from roll_counter_entries e
using roll_counter_banned_names b
where position(b.term in roll_counter_normalize_name(e.name)) > 0;
