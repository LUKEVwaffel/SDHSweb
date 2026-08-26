// One-off: mark every cadet on the official RAIDER_TEAMS roster (src/lib/raiderRoster.js)
// as a Raiders team member in cadet_teams (Dispatch's real team-membership table —
// see supabase/opticsend.sql SECTION 3). Requires a service-role key since
// cadet_teams is s6-authenticated-only via RLS; run locally, never commit the key.
//
// Usage: node --env-file=.env --env-file=.env.local scripts/mark-raiders-team.mjs [--dry-run]
// (put SUPABASE_SERVICE_ROLE_KEY in .env.local — never commit it)

import { createClient } from '@supabase/supabase-js';
import { RAIDER_TEAMS, teamsForName, normalizeName } from '../src/lib/raiderRoster.js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.argv.includes('--dry-run');

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data: cadets, error: cadetErr } = await sb.from('cadet_consent').select('id, name');
if (cadetErr) { console.error('Failed to load cadet_consent:', cadetErr.message); process.exit(1); }

const { data: existing, error: existErr } = await sb.from('cadet_teams').select('cadet_consent_id').eq('team', 'raiders');
if (existErr) { console.error('Failed to load cadet_teams:', existErr.message); process.exit(1); }
const alreadyOn = new Set((existing || []).map((r) => r.cadet_consent_id));

const toInsert = [];
const matchedRosterNames = new Set();

for (const cadet of cadets || []) {
  const teams = teamsForName(cadet.name);
  if (!teams.length) continue;
  matchedRosterNames.add(cadet.name);
  if (alreadyOn.has(cadet.id)) continue;
  toInsert.push({ cadet_consent_id: cadet.id, team: 'raiders' });
}

// Roster names that matched no cadet_consent row at all.
const cadetKeys = new Set((cadets || []).map((c) => normalizeName(c.name)));
const allRosterNames = RAIDER_TEAMS.flatMap((t) => t.members);
const unmatched = allRosterNames.filter((n) => !cadetKeys.has(normalizeName(n)));

console.log(`Roster size: ${allRosterNames.length} names across ${RAIDER_TEAMS.length} sub-teams`);
console.log(`cadet_consent rows matched: ${matchedRosterNames.size}`);
console.log(`Already marked 'raiders': ${[...alreadyOn].length}`);
console.log(`New cadet_teams rows to insert: ${toInsert.length}`);
if (unmatched.length) {
  console.log(`Roster names with no cadet_consent match (${unmatched.length}):`);
  for (const n of unmatched) console.log(`  - ${n}`);
}

if (dryRun) {
  console.log('--dry-run: no writes performed.');
  process.exit(0);
}

if (toInsert.length) {
  const { error: insErr } = await sb.from('cadet_teams').insert(toInsert);
  if (insErr) { console.error('Insert failed:', insErr.message); process.exit(1); }
  console.log(`Inserted ${toInsert.length} cadet_teams rows.`);
} else {
  console.log('Nothing to insert — everyone matched is already marked.');
}
