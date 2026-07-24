-- ============================================================================
-- EMAIL BUILDER — adds structured drag-and-drop content to email_messages.
-- Run in the Supabase SQL editor (same project as email_system.sql). Idempotent.
--
-- The builder authors a list of blocks (text / heading / image / button /
-- divider / spacer / attachment). On save the client stores THREE things:
--   content_json : the block array — the editable source of truth
--   body_html    : branded HTML rendered from the blocks — what actually SENDS
--                  and what the signature PDF prints (they match exactly)
--   body         : plaintext fallback (existing column) — the email text part
--
-- Storing body_html means the edge function does not re-render anything: it
-- ships the exact HTML the SAI/1SG physically signed off on. No renderer is
-- duplicated in Deno, and there is no "what you signed ≠ what sent" gap.
-- ============================================================================

alter table public.email_messages
  add column if not exists content_json jsonb,
  add column if not exists body_html    text;

-- Existing plaintext drafts remain valid: content_json/body_html stay null and
-- the send path falls back to the plaintext `body`.

-- ============================================================================
-- STORAGE BUCKET (do this in Dashboard → Storage, or via the snippet below):
--   Name:   email-attachments
--   Public: YES  (Resend fetches attachment files by public URL at send time;
--                 these are outbound newsletter attachments, not private data)
--
-- SQL alternative to the dashboard (uncomment to run):
--   insert into storage.buckets (id, name, public)
--   values ('email-attachments', 'email-attachments', true)
--   on conflict (id) do update set public = true;
--
-- Allow anon-key uploads + public reads, matching the app's existing posture:
--   drop policy if exists email_attach_read  on storage.objects;
--   drop policy if exists email_attach_write on storage.objects;
--   create policy email_attach_read  on storage.objects
--     for select using (bucket_id = 'email-attachments');
--   create policy email_attach_write on storage.objects
--     for all using (bucket_id = 'email-attachments') with check (bucket_id = 'email-attachments');
-- ============================================================================
