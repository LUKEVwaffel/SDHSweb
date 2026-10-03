-- Breadstick counter: perma-ban Blyane / Blayne (both spellings).
-- Requires supabase/roll_counter_ban.sql to have been run first.
-- Anyone who tries one of these names afterwards has their IP and device
-- banned automatically.

insert into roll_counter_banned_names (term, reason) values
  ('blyane', 'Perma ban: Blyane'),
  ('blayne', 'Perma ban: Blyane (alt spelling)')
on conflict (term) do nothing;

-- Remove their existing entries, keeping the ids for the IP log lookup
-- described at the bottom of roll_counter_ban.sql.
insert into roll_counter_banned_entries (id, event, name, count, created_at)
select id, event, name, count, created_at
from roll_counter_entries
where roll_counter_is_banned_name(name)
on conflict (id) do nothing;

delete from roll_counter_entries
where roll_counter_is_banned_name(name);

-- IPs this name has already used since the IP log went live — ban them too.
insert into roll_counter_banned_ips (ip, reason)
select distinct l.ip, 'Perma ban: Blyane'
from roll_counter_ip_log l
where l.ip is not null and roll_counter_is_banned_name(l.name)
on conflict (ip) do nothing;
