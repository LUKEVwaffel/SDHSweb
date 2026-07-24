-- ============================================================================
-- DOCUMENTS TAB — fixes the never-created `documents` storage bucket and adds
-- title + confidentiality metadata. Run in the Supabase SQL editor. Idempotent.
--
-- ROOT CAUSE (bug report): MediaPanel.jsx has always listed `documents` as a
-- bucket, but unlike team-photos (see photo_hub_v2.sql) no
-- `insert into storage.buckets` was ever run for it, and no
-- storage.objects RLS policy exists for it. The bucket never existed, so every
-- list/upload call against it silently failed.
--
-- DESIGN NOTE: site-assets/team-photos/personnel-photos are intentionally
-- anon-open (public site images — see auth_rls.sql). Documents (consent PDFs,
-- policy letters) are admin-facing and now carry a confidentiality label, so
-- the bucket is created PRIVATE and gated to `is_s6()` — the SAME tier as
-- cadet_consent in admin_roles.sql SECTION 3d, not the older blanket
-- `authenticated` pattern in auth_rls.sql SECTION C (superseded by the role
-- system). The s5 scoped account (calendar-only) must NOT read/write any
-- document, confidential or not — reviewed and confirmed by security-reviewer.
-- Requires admin_roles.sql to have been run first (defines public.is_s6()).
-- ============================================================================

-- ── 1. Storage bucket (private) ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do update set public = false;

drop policy if exists documents_obj_read   on storage.objects;
drop policy if exists documents_obj_insert on storage.objects;
drop policy if exists documents_obj_update on storage.objects;
drop policy if exists documents_obj_delete on storage.objects;
create policy documents_obj_read   on storage.objects for select to authenticated using (bucket_id = 'documents' and public.is_s6());
create policy documents_obj_insert on storage.objects for insert to authenticated with check (bucket_id = 'documents' and public.is_s6());
-- UPDATE policy required because MediaPanel uploads with { upsert: true }.
create policy documents_obj_update on storage.objects for update to authenticated using (bucket_id = 'documents' and public.is_s6()) with check (bucket_id = 'documents' and public.is_s6());
create policy documents_obj_delete on storage.objects for delete to authenticated using (bucket_id = 'documents' and public.is_s6());

-- ── 2. Metadata table: title + confidentiality per uploaded file ───────────
create table if not exists public.document_meta (
  id              uuid primary key default gen_random_uuid(),
  storage_path    text not null unique,
  title           text not null check (length(trim(title)) > 0),
  confidentiality text not null default 'internal'
                    check (confidentiality in ('public', 'internal', 'confidential')),
  -- Server-set from the JWT, not client-supplied — cannot be spoofed as an audit trail.
  uploaded_by     text not null default (auth.jwt() ->> 'email'),
  created_at      timestamptz not null default now()
);

alter table public.document_meta enable row level security;

drop policy if exists document_meta_all_auth on public.document_meta;
drop policy if exists document_meta_all_s6   on public.document_meta;
create policy document_meta_all_s6 on public.document_meta
  for all to authenticated using (public.is_s6()) with check (public.is_s6());

-- ============================================================================
-- Verify: select * from storage.buckets where id = 'documents';
--         select * from public.document_meta;
-- ============================================================================
