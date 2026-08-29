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
//
// 'raider-parents-male' / 'raider-parents-coed' / 'raider-parents-all' read
// cadet_consent.parent_email (+ parent_email2) for cadets tagged
// cadet_teams.team='raiders' with the matching cadet_teams.squad. The squad
// tag is seeded + maintained separately (supabase/raider_squads.sql, then the
// Cadet Database picker) — no name matching happens here. A raider cadet with
// no parent_email on file contributes nothing.
export const AUDIENCE_GROUPS = [
  { id: 'broadcast',           label: 'ALL SUBSCRIBERS' }, // default: recipient_emails stays null
  { id: 'staff',               label: 'STAFF' },
  { id: 'company-command',     label: 'COMPANY COMMAND' },
  { id: 'company-alpha',       label: 'ALPHA COMPANY' },
  { id: 'company-bravo',       label: 'BRAVO COMPANY' },
  { id: 'company-charlie',     label: 'CHARLIE COMPANY' },
  { id: 'company-delta',       label: 'DELTA COMPANY' },
  { id: 'all-cadets',          label: 'ALL CADETS' },
  { id: 'raider-parents-male', label: 'MALE RAIDER PARENTS' },
  { id: 'raider-parents-coed', label: 'COED RAIDER PARENTS' },
  { id: 'raider-parents-all',  label: 'RAIDER PARENTS (MALE + COED)' },
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

  const rp = /^raider-parents-(male|coed|all)$/.exec(groupId);
  if (rp) {
    const squads = rp[1] === 'all' ? ['male', 'coed'] : [rp[1]];
    const { data, error } = await SB
      .from('cadet_teams')
      .select('squad, cadet_consent:cadet_consent_id(parent_email, parent_email2)')
      .eq('team', 'raiders')
      .in('squad', squads);
    if (error) throw error;
    const emails = [];
    for (const r of data || []) {
      emails.push(r.cadet_consent?.parent_email, r.cadet_consent?.parent_email2);
    }
    return clean(emails);
  }

  throw new Error(`Unknown audience group: ${groupId}`);
}
