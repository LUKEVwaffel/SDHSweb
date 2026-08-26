-- ============================================================================
-- AAR (After Action Report) TRACKER — S-5 owned. Run in the Supabase SQL
-- editor. Idempotent. Requires admin_roles.sql (public.is_admin()) to have
-- already run.
--
-- DESIGN
--   • AARs are usually tied to an event, but event_id is nullable — a
--     standalone AAR (no linked event) is a supported first-class case, same
--     nullable-FK pattern as raider_photo_hub.sql's optional event_id.
--   • Storage: dedicated private `aar-documents` bucket, separate from the
--     existing `documents` bucket. New bucket, new policy tier: is_s5()
--     for writes — AAR tracking is S-5's dedicated tool. Luke additionally
--     gets read-only visibility (is_luke(), see SECTION 2's aars_select_luke
--     and this section's aar_documents_obj_read) so he can view/verify AARs
--     from his own DISPATCH login without taking over S-5's write workflow;
--     no other s6 account gets a nav entry or RLS grant here.
--   • Backup = soft delete. There is no hard-delete path from the app. A
--     "delete" sets status='archived' (+archived_at/archived_by); the file
--     stays in storage and the row stays queryable/restorable. True
--     hard-delete is a service-role/SQL-editor-only operation, same tier as
--     document_meta.
--   • Two AAR sources, one table: `source` = 'uploaded' (file in
--     aar-documents, storage_path/file_name required) or 'drafted' (written
--     directly in DISPATCH, content_* columns required, no storage object at
--     all). The CHECK constraint below enforces exactly one shape per row.
-- ============================================================================

-- ── 1. Storage bucket (private) ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('aar-documents', 'aar-documents', false)
  on conflict (id) do update set public = false;

drop policy if exists aar_documents_obj_read   on storage.objects;
drop policy if exists aar_documents_obj_insert on storage.objects;
drop policy if exists aar_documents_obj_update on storage.objects;
drop policy if exists aar_documents_obj_delete on storage.objects;
create policy aar_documents_obj_read   on storage.objects for select to authenticated using (bucket_id = 'aar-documents' and (public.is_s5() or public.is_luke()));
create policy aar_documents_obj_insert on storage.objects for insert to authenticated with check (bucket_id = 'aar-documents' and public.is_s5());
create policy aar_documents_obj_update on storage.objects for update to authenticated using (bucket_id = 'aar-documents' and public.is_s5()) with check (bucket_id = 'aar-documents' and public.is_s5());
create policy aar_documents_obj_delete on storage.objects for delete to authenticated using (bucket_id = 'aar-documents' and public.is_s5());

-- ── 2. aars table ────────────────────────────────────────────────────────────
create table if not exists public.aars (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid references public.events(id) on delete set null,
  title           text not null check (length(trim(title)) > 0),
  aar_date        date,
  summary         text,
  storage_path    text unique,
  file_name       text,
  confidentiality text not null default 'internal'
                    check (confidentiality in ('public', 'internal', 'confidential')),
  status          text not null default 'active' check (status in ('active', 'archived')),
  archived_at     timestamptz,
  archived_by     text,
  -- Server-set from the JWT, not client-supplied — cannot be spoofed as an audit trail.
  created_by      text not null default (auth.jwt() ->> 'email'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  source                     text not null default 'uploaded' check (source in ('uploaded', 'drafted')),
  content_went_well          text,
  content_needs_improvement  text,
  content_summary            text
);

-- Idempotent widen — safe to re-run even after the table already exists from
-- an earlier version of this script (uploaded-only, NOT NULL file columns).
alter table public.aars alter column storage_path drop not null;
alter table public.aars alter column file_name    drop not null;
alter table public.aars add column if not exists source                    text not null default 'uploaded' check (source in ('uploaded', 'drafted'));
alter table public.aars add column if not exists content_went_well         text;
alter table public.aars add column if not exists content_needs_improvement text;
alter table public.aars add column if not exists content_summary          text;

create index if not exists aars_event_idx on public.aars(event_id);

-- Exactly one shape per row: an uploaded file, or drafted content.
alter table public.aars drop constraint if exists aars_source_content_check;
alter table public.aars add constraint aars_source_content_check check (
  (source = 'uploaded' and storage_path is not null and file_name is not null)
  or
  (source = 'drafted' and content_summary is not null and length(trim(content_summary)) > 0)
);

alter table public.aars enable row level security;

drop policy if exists aars_all_admin on public.aars;
drop policy if exists aars_all_s5 on public.aars;
create policy aars_all_s5 on public.aars
  for all to authenticated using (public.is_s5()) with check (public.is_s5());

-- Luke gets read-only visibility into S-5's AAR tracker (view/search/print),
-- not write — S-5 stays the sole owner of drafting/uploading/archiving.
-- public.is_luke() is defined in tv_photos.sql (single choke-point,
-- see that file's comment) — run it first if this policy fails to create.
drop policy if exists aars_select_luke on public.aars;
create policy aars_select_luke on public.aars
  for select to authenticated using (public.is_luke());

-- ============================================================================
-- Verify: select * from storage.buckets where id = 'aar-documents';
--         select * from public.aars;
-- ============================================================================
