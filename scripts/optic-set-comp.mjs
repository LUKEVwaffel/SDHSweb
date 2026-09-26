// Point OPTIC at the next comp and lock the feed until it opens — the
// terminal version of what optic_east_hamilton_events.sql did by hand.
//
//   1. find the comp's `events` row (title match, team 'raiders'), or create
//      it with --create (posted, so photos_require_posted_event accepts uploads)
//   2. optic_config.active_event_id -> that event (fresh, empty feed)
//   3. rhea_gate -> mode 'auto', opens_at = --opens, is_open false (locked
//      with a countdown until then; Luke can still FORCE OPEN from /lukepwa)
//
// Past comps' photos are untouched — they keep their own event_id.
//
// Usage:
//   node --env-file=.env.migrate scripts/optic-set-comp.mjs --find "warren" --opens 2026-09-26T08:00:00-04:00 --dry-run
//   node --env-file=.env.migrate scripts/optic-set-comp.mjs --find "warren" --opens 2026-09-26T08:00:00-04:00
//   add --create "Warren County Raider Competition" --date 2026-09-26 if no event row exists yet
//   add --event <uuid> to pick one when --find matches several
// Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const argVal = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const dryRun = args.includes('--dry-run');
const find = argVal('--find');
const opens = argVal('--opens');
const pickId = argVal('--event');
const createTitle = argVal('--create');
const createDate = argVal('--date');

const { VITE_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
if (!url || !key) { console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.'); process.exit(1); }
if (!find && !pickId && !createTitle) { console.error('Pass --find "<title words>", --event <uuid>, or --create "<title>".'); process.exit(1); }
if (!opens || Number.isNaN(new Date(opens).getTime())) { console.error('Pass --opens as ISO with offset, e.g. 2026-09-26T08:00:00-04:00'); process.exit(1); }

const sb = createClient(url, key, { auth: { persistSession: false } });
const fail = (msg) => { console.error(msg); process.exit(1); };

async function resolveEvent() {
  if (pickId) {
    const { data, error } = await sb.from('events').select('*').eq('id', pickId).maybeSingle();
    if (error) fail(error.message);
    if (!data) fail(`No event with id ${pickId}.`);
    return data;
  }
  if (find) {
    const { data, error } = await sb.from('events').select('*')
      .ilike('title', `%${find}%`).order('date', { ascending: false });
    if (error) fail(error.message);
    const raiders = (data || []).filter((e) => e.team === 'raiders');
    if (raiders.length === 1) return raiders[0];
    if (raiders.length > 1) {
      console.log('Several Raider events match — re-run with --event <id>:');
      raiders.forEach((e) => console.log(`  ${e.id}  ${e.date}  ${e.status}  ${e.title}`));
      process.exit(1);
    }
    if (data?.length) {
      console.log('Matches found, but none are team "raiders" (photos for OPTIC must be):');
      data.forEach((e) => console.log(`  ${e.id}  ${e.date}  team=${e.team}  ${e.status}  ${e.title}`));
    }
    if (!createTitle) fail(`No Raider event matching "${find}". Re-run with --create "<title>" --date YYYY-MM-DD.`);
  }
  if (!createDate) fail('--create needs --date YYYY-MM-DD.');
  const row = {
    title: createTitle, date: createDate, team: 'raiders', category: 'RAIDER',
    status: 'posted', will_have_pictures: true,
  };
  if (dryRun) { console.log('Would create event:', row); return { id: '<new>', ...row }; }
  const { data, error } = await sb.from('events').insert(row).select().single();
  if (error) fail(`Could not create event: ${error.message}`);
  console.log(`Created event ${data.id}`);
  return data;
}

const event = await resolveEvent();
console.log(`Event:  ${event.title}  (${event.date})  id=${event.id}  status=${event.status}`);
if (event.status !== 'posted') {
  console.log('  ! Event is not posted — uploads would be rejected. Setting status=posted.');
}

const opensIso = new Date(opens).toISOString();
console.log(`Gate:   locked until ${new Date(opens).toString()}`);

if (dryRun) { console.log('\n(dry run — nothing changed)'); process.exit(0); }

if (event.status !== 'posted') {
  const { error } = await sb.from('events').update({ status: 'posted' }).eq('id', event.id);
  if (error) fail(`Could not post event: ${error.message}`);
}

const { error: cfgErr } = await sb.from('optic_config')
  .update({ active_event_id: event.id, updated_at: new Date().toISOString() }).eq('id', 'default');
if (cfgErr) fail(`optic_config update failed: ${cfgErr.message}`);

const { error: gateErr } = await sb.from('rhea_gate')
  .update({ mode: 'auto', opens_at: opensIso, is_open: false, updated_at: new Date().toISOString() })
  .eq('id', 'default');
if (gateErr) fail(`rhea_gate update failed: ${gateErr.message}`);

const [{ data: cfg }, { data: gate }] = await Promise.all([
  sb.from('optic_config').select('active_event_id').eq('id', 'default').single(),
  sb.from('rhea_gate').select('mode, opens_at, is_open').eq('id', 'default').single(),
]);
console.log('\nDone.');
console.log('  optic_config.active_event_id =', cfg?.active_event_id);
console.log('  rhea_gate =', gate);
