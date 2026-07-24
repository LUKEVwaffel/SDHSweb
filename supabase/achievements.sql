-- ============================================================================
-- Accomplishments/achievements system — catalog + per-cadet assignment,
-- manageable from DISPATCH (Achievements panel) instead of one-off SQL.
-- Run in the Supabase SQL editor. Idempotent.
--
-- Icons: PNG only, not SVG. Precedent: admin-avatars bucket (account_picker.sql
-- SECTION 5) deliberately excludes SVG uploads even from is_s6()-gated admins,
-- because the bucket is public-read and an inline-script SVG served from our
-- origin is a stored-XSS vector. Same reasoning applies here — achievement
-- icons render on the public profile page.
-- ============================================================================

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  icon_url text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table if not exists public.cadet_achievements (
  id uuid primary key default gen_random_uuid(),
  personnel_id text not null references public.personnel(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  date_earned date,
  note text,
  created_at timestamptz default now(),
  unique (personnel_id, achievement_id)
);

create index if not exists cadet_achievements_personnel_idx on public.cadet_achievements(personnel_id);

-- ── RLS — same PUBLIC-READ / s6-write pattern as personnel (auth_rls.sql
-- SECTION A + admin_roles.sql). Public profile page reads both tables under
-- the anon key; only a signed-in s6 admin may write.
alter table public.achievements enable row level security;
alter table public.cadet_achievements enable row level security;

select public._drop_all_policies('achievements');
select public._drop_all_policies('cadet_achievements');

create policy achievements_read_public on public.achievements
  for select to anon, authenticated using (true);
create policy achievements_ins_s6 on public.achievements
  for insert to authenticated with check (public.is_s6());
create policy achievements_upd_s6 on public.achievements
  for update to authenticated using (public.is_s6()) with check (public.is_s6());
create policy achievements_del_s6 on public.achievements
  for delete to authenticated using (public.is_s6());

create policy cadet_achievements_read_public on public.cadet_achievements
  for select to anon, authenticated using (true);
create policy cadet_achievements_ins_s6 on public.cadet_achievements
  for insert to authenticated with check (public.is_s6());
create policy cadet_achievements_upd_s6 on public.cadet_achievements
  for update to authenticated using (public.is_s6()) with check (public.is_s6());
create policy cadet_achievements_del_s6 on public.cadet_achievements
  for delete to authenticated using (public.is_s6());


-- ── achievement-icons storage bucket — public read, s6-only write, PNG/WEBP only.
insert into storage.buckets (id, name, public)
values ('achievement-icons', 'achievement-icons', true)
on conflict (id) do nothing;

drop policy if exists achievement_icons_read   on storage.objects;
drop policy if exists achievement_icons_write  on storage.objects;
drop policy if exists achievement_icons_update on storage.objects;
drop policy if exists achievement_icons_delete on storage.objects;

create policy achievement_icons_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'achievement-icons');
create policy achievement_icons_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'achievement-icons' and public.is_s6()
              and (metadata->>'mimetype') in ('image/png','image/webp'));
create policy achievement_icons_update on storage.objects
  for update to authenticated
  using (bucket_id = 'achievement-icons' and public.is_s6())
  with check (bucket_id = 'achievement-icons' and public.is_s6()
              and (metadata->>'mimetype') in ('image/png','image/webp'));
create policy achievement_icons_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'achievement-icons' and public.is_s6());
