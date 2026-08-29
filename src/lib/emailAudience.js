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
// 'raider-parents-male' / 'raider-parents-coed' read cadet_consent.parent_email
// (+ parent_email2). There is no male/coed split in the DB — cadet_teams only
// knows team='raiders' — so the roster split comes from src/lib/raiderRoster.js
// (RAIDER_TEAMS), matched to cadet_consent rows by normalized name. Cadets whose
// roster name doesn't match a cadet_consent row, or whose row has no parent
// email, are silently skipped.
import { RAIDER_TEAMS } from './raiderRoster';

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

// Roster names carry things a cadet_consent row won't: "(Senior)" / "(Freshman)"
// disambiguators, punctuation, casing. Strip all of it to a bare lowercase
// "first last" for comparison. Known spelling drift between the two sources goes
// in NAME_ALIASES (roster spelling → cadet_consent spelling), both normalized.
const NAME_ALIASES = {
  'mya sneideman': 'mya sneidman',
};

function normalizeName(name) {
  const n = (name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // drop "(Senior)" etc.
    .replace(/[^a-z\s]/g, ' ')  // drop punctuation
    .replace(/\s+/g, ' ')
    .trim();
  return NAME_ALIASES[n] || n;
}

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
    const keys = rp[1] === 'all' ? ['male', 'coed'] : [rp[1]];
    const members = RAIDER_TEAMS.filter((t) => keys.includes(t.key)).flatMap((t) => t.members || []);
    const wanted = new Set(members.map(normalizeName));
    if (!wanted.size) throw new Error(`No roster on file for ${rp[1]} raiders`);
    const { data, error } = await SB.from('cadet_consent').select('name, parent_email, parent_email2');
    if (error) throw error;
    const emails = [];
    for (const r of data || []) {
      if (!wanted.has(normalizeName(r.name))) continue;
      emails.push(r.parent_email, r.parent_email2);
    }
    return clean(emails);
  }

  throw new Error(`Unknown audience group: ${groupId}`);
}
