-- Breadstick counter: perma-ban Juaqyine McOff (first name or last name).
-- Requires supabase/roll_counter_ban.sql to have been run first.

insert into roll_counter_banned_names (term, reason) values
  ('juaqyine', 'Perma ban: Juaqyine McOff'),
  ('mcoff', 'Perma ban: Juaqyine McOff (last name)')
on conflict (term) do nothing;

-- Remove their existing entries, keeping the ids for the IP log lookup.
insert into roll_counter_banned_entries (id, event, name, count, created_at)
select id, event, name, count, created_at
from roll_counter_entries
where roll_counter_is_banned_name(name)
on conflict (id) do nothing;

delete from roll_counter_entries
where roll_counter_is_banned_name(name);

-- IPs this name has already used since the IP log went live — ban them too.
insert into roll_counter_banned_ips (ip, reason)
select distinct l.ip, 'Perma ban: Juaqyine McOff'
from roll_counter_ip_log l
where l.ip is not null and roll_counter_is_banned_name(l.name)
on conflict (ip) do nothing;
