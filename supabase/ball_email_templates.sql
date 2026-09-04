-- ============================================================================
-- BALL EMAIL TEMPLATES — S-6-editable prose layer for every automated email
-- the Military Ball sends. Run in the Supabase SQL editor. Idempotent.
--
-- Each edge function that sends a ball email now loads its row here first and
-- uses these fields for the SUBJECT / HEADING / INTRO / NOTICE / CLOSING. If a
-- field is NULL/blank, or the row is missing, the function falls back to its
-- built-in default — so a bad edit or a missing row can never stop a send.
-- The dynamic parts (event particulars from ball_config, the "what remains"
-- checklist, the PDF attachment) stay code-controlled.
--
-- Placeholders: {{name}} style tokens are substituted by the sending function.
-- Each row's `placeholders` column documents which are available for it.
--
-- `enabled = false` stops that email entirely (function returns ok, skipped).
-- ============================================================================

create table if not exists public.ball_email_templates (
  key           text primary key,
  label         text not null,
  description   text not null,          -- trigger + recipient, shown in the panel
  placeholders  text not null default '',
  enabled       boolean not null default true,
  subject       text,
  heading       text,
  intro_html    text,                   -- blank line => paragraph break
  notice_html   text,                   -- the gold callout line; blank => omitted
  closing_html  text,
  updated_at    timestamptz not null default now(),
  updated_by    text
);

alter table public.ball_email_templates enable row level security;

-- S-6 only, and only through an authenticated DISPATCH session. Edge functions
-- read/write with the service role, which bypasses RLS.
drop policy if exists ball_email_templates_s6_all on public.ball_email_templates;
create policy ball_email_templates_s6_all on public.ball_email_templates
  for all to authenticated
  using (public.is_s6()) with check (public.is_s6());

grant select, update on public.ball_email_templates to authenticated;

-- ── seed / refresh the 5 rows (label/description/placeholders always refreshed;
--    the editable prose is only seeded on first insert so a re-run never
--    clobbers S-6's edits) ────────────────────────────────────────────────────
insert into public.ball_email_templates
  (key, label, description, placeholders, subject, heading, intro_html, notice_html, closing_html)
values
  (
    'registration_received',
    'Registration received (cadet)',
    'Sent to the cadet''s personal email the moment they finish signup. The field-trip PDF is attached for SDHS students. The "What Remains" checklist below the intro is built automatically.',
    '{{name}} {{meta}} {{amount_due}} {{deadline}} {{ball_date}}',
    'Trojan Battalion Military Ball: Registration Received',
    'Registration Received',
    '{{name}},

Your registration for the Trojan Battalion Military Ball has been received and recorded{{meta}}.',
    'All items above must be completed on or before {{deadline}}.',
    'You will receive further notice as your payment and any required forms are recorded.'
  ),
  (
    'guest_invitation',
    'Guest invitation (verify link)',
    'Sent to the guest''s personal email when a signup includes a guest. Contains the one-time confirm-attendance button. Always sends even if disabled here — the guest cannot confirm without this link. Event particulars are inserted automatically.',
    '{{guest_name}} {{cadet_name}} {{verify_url}}',
    'Trojan Battalion Military Ball: Invitation',
    'You Are Invited',
    '{{guest_name}},

{{cadet_name}} has requested the honor of your company at the Trojan Battalion Military Ball.',
    '',
    'This step confirms any food allergies and your review of the attire requirements. Your host''s registration is not complete until it is done.'
  ),
  (
    'guest_verified',
    'Guest verified (cadet)',
    'Sent to the cadet''s notification email once their guest finishes their part of the signup.',
    '{{cadet_name}} {{guest_name}} {{site_url}}',
    'Your Ball guest is verified',
    'Guest Confirmed',
    'Your guest has finished their part of the Military Ball signup. Your entry is now fully verified.',
    '',
    ''
  ),
  (
    'signup_update',
    'Signup update (cash / form received)',
    'Sent to the cadet''s notification email when Kaz or Chief marks a cash payment or field-trip form as received in the Ball Payments portal.',
    '{{cadet_name}} {{what}}',
    'Military Ball signup update',
    'Signup Update',
    '{{what}} for {{cadet_name}}.',
    '',
    ''
  ),
  (
    'allergy_flag',
    'New allergy flag (S-5)',
    'Sent to every S-5 when a cadet submits a signup with a food allergy flagged. {{contact}} = the cadet''s phone and/or email, or a note that neither is on file.',
    '{{cadet_name}} {{contact}} {{dispatch_url}}',
    'New Ball allergy flag: {{cadet_name}}',
    'Food Allergy Flagged',
    '{{cadet_name}} flagged a food allergy on their Military Ball signup.

Reach them: {{contact}}. Call or text is fastest.',
    '',
    ''
  )
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  placeholders = excluded.placeholders;

-- verify:
--   select key, enabled, left(intro_html, 40) from public.ball_email_templates order by key;
-- ============================================================================
