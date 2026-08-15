// Recipient-audience groups for the email composer (Messages.jsx). Resolves
// a group id to a concrete email list at save time — the actual targeting
// mechanism is email_messages.recipient_emails, which already exists (see
// supabase/opticsend.sql SECTION 6, read as-is by send-email). This module
// just adds more ways to populate it besides OpticSend and the single
// manual test-recipient field.
//
// 'staff' / 'company-command' read personnel.email (public-read table).
// 'company-*' / 'all-cadets' read cadet_consent.school_email — NEVER
// parent_email, and cadet_consent is s6-only RLS, so these only resolve
// correctly when called by an s6 admin (Messages.jsx is already s6-gated).
export const AUDIENCE_GROUPS = [
  { id: 'broadcast',       label: 'ALL SUBSCRIBERS' }, // default: recipient_emails stays null
  { id: 'staff',           label: 'STAFF' },
  { id: 'company-command', label: 'COMPANY COMMAND' },
  { id: 'company-alpha',   label: 'ALPHA COMPANY' },
  { id: 'company-bravo',   label: 'BRAVO COMPANY' },
  { id: 'company-charlie', label: 'CHARLIE COMPANY' },
  { id: 'company-delta',   label: 'DELTA COMPANY' },
  { id: 'all-cadets',      label: 'ALL CADETS' },
];

const COMPANIES = ['alpha', 'bravo', 'charlie', 'delta'];

function clean(emails) {
  return Array.from(new Set(
    (emails || [])
      .map((e) => (e || '').trim().toLowerCase())
      .filter(Boolean)
  ));
}

// Returns null for 'broadcast' (meaning: clear recipient_emails, use the
// normal full-subscriber-list send) or a non-empty-checked string[] for
// every other group.
export async function resolveAudienceEmails(SB, groupId) {
  if (groupId === 'broadcast') return null;

  if (groupId === 'staff' || groupId === 'company-command') {
    let q = SB.from('personnel').select('email, section');
    q = groupId === 'staff' ? q.not('section', 'like', 'company-%') : q.like('section', 'company-%');
    const { data, error } = await q;
    if (error) throw error;
    return clean((data || []).map((r) => r.email));
  }

  if (groupId === 'all-cadets') {
    const { data, error } = await SB.from('cadet_consent').select('school_email').in('company', COMPANIES);
    if (error) throw error;
    return clean((data || []).map((r) => r.school_email));
  }

  const m = /^company-(alpha|bravo|charlie|delta)$/.exec(groupId);
  if (m) {
    const { data, error } = await SB.from('cadet_consent').select('school_email').eq('company', m[1]);
    if (error) throw error;
    return clean((data || []).map((r) => r.school_email));
  }

  throw new Error(`Unknown audience group: ${groupId}`);
}
