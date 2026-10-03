-- Breadstick / roll counter permanent bans (by name and by IP).
-- The counter is anon read/write, so bans have to live in the database. A
-- trigger on roll_counter_entries:
--   * logs the caller's IP for every signup / tap (private table),
--   * silently drops any write from a banned IP,
--   * drops any signup or rename to a banned name AND bans that caller's IP
--     on the spot, so the next attempt under a clean name is dead too.
-- Rejections return NULL instead of raising so the IP ban insert isn't rolled
-- back with the failed write. None of these tables are readable by anon.

-- ── Banned names ───────────────────────────────────────────────────────────
create table if not exists roll_counter_banned_names (
  term text primary key check (term = lower(term) and term ~ '^[a-z]+$'),
  reason text,
  created_at timestamptz not null default now()
);
alter table roll_counter_banned_names enable row level security;

insert into roll_counter_banned_names (term, reason)
values ('cockmaster', 'Perma ban: cockmaster6000')
on conflict (term) do nothing;

-- ── Banned IPs ─────────────────────────────────────────────────────────────
create table if not exists roll_counter_banned_ips (
  ip inet primary key,
  reason text,
  created_at timestamptz not null default now()
);
alter table roll_counter_banned_ips enable row level security;

-- ── Per-request IP log ─────────────────────────────────────────────────────
create table if not exists roll_counter_ip_log (
  id bigint generated always as identity primary key,
  entry_id uuid,
  name text,
  op text not null,
  ip inet,
  forwarded_for text,
  blocked text,
  seen_at timestamptz not null default now()
);
create index if not exists roll_counter_ip_log_entry_idx on roll_counter_ip_log (entry_id);
create index if not exists roll_counter_ip_log_ip_idx on roll_counter_ip_log (ip);
alter table roll_counter_ip_log enable row level security;

-- Entries removed by a ban, kept so their ids can be matched against the
-- Supabase API logs (taps are PATCH ...?id=eq.<id>) to recover the IP.
create table if not exists roll_counter_banned_entries (
  id uuid primary key,
  event text,
  name text,
  count integer,
  created_at timestamptz,
  removed_at timestamptz not null default now()
);
alter table roll_counter_banned_entries enable row level security;

-- ── Helpers ────────────────────────────────────────────────────────────────
create or replace function roll_counter_normalize_name(raw text)
returns text language sql immutable as $$
  select regexp_replace(
    translate(lower(coalesce(raw, '')), '013457@$!|', 'oieastasii'),
    '[^a-z]', '', 'g'
  );
$$;

create or replace function roll_counter_is_banned_name(raw text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from roll_counter_banned_names b
    where position(b.term in roll_counter_normalize_name(raw)) > 0
  );
$$;

-- Caller IP as PostgREST sees it. cf-connecting-ip is set by Supabase's edge
-- and can't be spoofed by the client; x-forwarded-for's first hop is the
-- fallback.
create or replace function roll_counter_request_ip()
returns inet language plpgsql stable as $$
declare
  headers json := nullif(current_setting('request.headers', true), '')::json;
  raw text;
begin
  if headers is null then return null; end if;
  raw := coalesce(
    nullif(headers ->> 'cf-connecting-ip', ''),
    nullif(headers ->> 'x-real-ip', ''),
    nullif(trim(split_part(headers ->> 'x-forwarded-for', ',', 1)), '')
  );
  return raw::inet;
exception when others then
  return null;
end;
$$;

-- ── Guard trigger ──────────────────────────────────────────────────────────
drop trigger if exists roll_counter_ban_guard on roll_counter_entries;

create or replace function roll_counter_ban_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  caller_ip inet := roll_counter_request_ip();
  fwd text := nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for';
  name_changed boolean := tg_op = 'INSERT' or new.name is distinct from old.name;
begin
  if caller_ip is not null
     and exists (select 1 from roll_counter_banned_ips where ip = caller_ip) then
    insert into roll_counter_ip_log (entry_id, name, op, ip, forwarded_for, blocked)
    values (new.id, new.name, tg_op, caller_ip, fwd, 'ip');
    return null;
  end if;

  if name_changed and roll_counter_is_banned_name(new.name) then
    insert into roll_counter_ip_log (entry_id, name, op, ip, forwarded_for, blocked)
    values (new.id, new.name, tg_op, caller_ip, fwd, 'name');
    if caller_ip is not null then
      insert into roll_counter_banned_ips (ip, reason)
      values (caller_ip, 'Auto: tried banned name "' || new.name || '"')
      on conflict (ip) do nothing;
    end if;
    return null;
  end if;

  insert into roll_counter_ip_log (entry_id, name, op, ip, forwarded_for)
  values (new.id, new.name, tg_op, caller_ip, fwd);
  return new;
end;
$$;

create trigger roll_counter_ban_guard
  before insert or update on roll_counter_entries
  for each row execute function roll_counter_ban_guard();

-- ── Banned devices (FingerprintJS visitorId) ───────────────────────────────
create table if not exists roll_counter_banned_devices (
  fingerprint text primary key,
  reason text,
  created_at timestamptz not null default now()
);
alter table roll_counter_banned_devices enable row level security;

create or replace function roll_counter_caller_is_banned()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from roll_counter_banned_ips where ip = roll_counter_request_ip()
  );
$$;

-- Banned IPs can't read the leaderboard either (direct API calls included).
drop policy if exists "roll_counter_select_all" on roll_counter_entries;
create policy "roll_counter_select_all" on roll_counter_entries
  for select using (not (select roll_counter_caller_is_banned()));

-- Page-load check-in from /breadsticks. Logs the view, and answers whether
-- this visitor is banned by IP, by device fingerprint, or because the device
-- already carries the client-side ban flag. A banned visitor's current IP and
-- fingerprint are both added to the ban lists, so switching networks or
-- clearing site data on a known device doesn't get them back in.
create or replace function roll_counter_check_in(p_device text default null, p_flagged boolean default false)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare
  caller_ip inet := roll_counter_request_ip();
  fp text := nullif(nullif(split_part(coalesce(p_device, ''), '.', 1), ''), 'nofp');
  is_banned boolean;
begin
  if fp is not null and length(fp) > 128 then fp := null; end if;

  is_banned := coalesce(p_flagged, false)
    or (caller_ip is not null and exists (select 1 from roll_counter_banned_ips where ip = caller_ip))
    or (fp is not null and exists (select 1 from roll_counter_banned_devices where fingerprint = fp));

  insert into roll_counter_ip_log (name, op, ip, forwarded_for, blocked)
  values (fp, 'VIEW', caller_ip,
          nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for',
          case when is_banned then 'view' end);

  if is_banned then
    if caller_ip is not null then
      insert into roll_counter_banned_ips (ip, reason)
      values (caller_ip, 'Auto: banned visitor showed up on this IP')
      on conflict (ip) do nothing;
    end if;
    if fp is not null then
      insert into roll_counter_banned_devices (fingerprint, reason)
      values (fp, 'Auto: banned visitor on this device')
      on conflict (fingerprint) do nothing;
    end if;
  end if;

  return is_banned;
end;
$$;
grant execute on function roll_counter_check_in(text, boolean) to anon, authenticated;

-- Used by the Vercel edge middleware (middleware.js), which passes the
-- visitor's IP since the request reaches Supabase from Vercel, not the phone.
create or replace function roll_counter_ip_is_banned(p_ip text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from roll_counter_banned_ips where ip = p_ip::inet);
exception when others then
  return false;
end;
$$;
grant execute on function roll_counter_ip_is_banned(text) to anon, authenticated;

-- ── Remove existing banned entries (keep their ids for the log lookup) ─────
insert into roll_counter_banned_entries (id, event, name, count, created_at)
select id, event, name, count, created_at
from roll_counter_entries
where roll_counter_is_banned_name(name)
on conflict (id) do nothing;

delete from roll_counter_entries
where roll_counter_is_banned_name(name);

-- ── Banning an IP by hand ──────────────────────────────────────────────────
-- 1. Get the removed entry's id:
--      select * from roll_counter_banned_entries;
-- 2. Supabase dashboard → Logs → Logs Explorer, run (swap in the id):
--      select timestamp, request.method, request.search, h.cf_connecting_ip, h.x_forwarded_for
--      from edge_logs
--        cross join unnest(metadata) as m
--        cross join unnest(m.request) as request
--        cross join unnest(request.headers) as h
--      where request.path like '%roll_counter_entries%'
--        and request.search like '%<entry id>%'
--      order by timestamp desc
--      limit 100;
-- 3. Ban it:
--      insert into roll_counter_banned_ips (ip, reason)
--      values ('<ip>', 'Perma ban: cockmaster6000') on conflict do nothing;
--
-- Unbanning (e.g. a shared school/restaurant IP got caught):
--      delete from roll_counter_banned_ips where ip = '<ip>';
--      delete from roll_counter_banned_devices where fingerprint = '<fp>';
