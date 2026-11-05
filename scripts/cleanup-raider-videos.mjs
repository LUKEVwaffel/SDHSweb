// Delete the old Supabase copies of Raider TV videos, ONLY after proving each
// one is safely in R2. Run scripts/migrate-raider-videos.mjs first; this
// reads its log (migration-log-raider-videos.csv).
//
// A file is deleted from Supabase only if ALL of these are true:
//   1. The migration log says it was copied (status already-in-r2 or uploaded).
//   2. R2 has it, with the same size as the log.
//   3. The Supabase copy is still the same size as the log (nothing changed).
//   4. The local backup in storage-backup/ exists with the same size.
// And the whole run stops before deleting anything if:
//   - any public.raider_videos row stores a Supabase URL instead of a plain
//     file name, or
//   - any code in src/, supabase/functions/ or scripts/ still reads or writes
//     the Supabase raider-videos bucket.
//
// Deletes go through the Supabase Storage API (never SQL on storage.objects),
// so the files are really removed and the quota goes down.
//
// Usage (from the repo root):
//   node --env-file=.env.migrate scripts/cleanup-raider-videos.mjs --dry-run
//   node --env-file=.env.migrate scripts/cleanup-raider-videos.mjs --yes
// Without --yes it only reports what it would delete.

import fs from 'node:fs';
import path from 'node:path';
import {
  loadEnv, supabaseAdmin, listSupabase, r2Size, backupSize, readCsv, writeCsv, mb,
} from './lib/storageMigration.mjs';

const BUCKET = 'raider-videos';
const MIGRATION_LOG = 'migration-log-raider-videos.csv';
const CLEANUP_LOG = 'migration-log-raider-videos-cleanup.csv';
const COPIED = new Set(['already-in-r2', 'uploaded']);
const DELETE_BATCH = 10;

// Code that would mean something still uses the Supabase bucket.
const CODE_DIRS = ['src', 'supabase/functions', 'scripts'];
const SKIP_FILES = new Set([
  'scripts/migrate-raider-videos.mjs', 'scripts/cleanup-raider-videos.mjs',
]);
const SUPABASE_USE_PATTERNS = [
  /storage\s*\.from\(\s*['"`]raider-videos['"`]\s*\)/,
  /storage\s*\.from\(\s*VIDEO_BUCKET\s*\)/,
  /storage\/v1\/object\/(public\/)?raider-videos/,
];

const args = process.argv.slice(2);
const really = args.includes('--yes') && !args.includes('--dry-run');

function codeStillUsingSupabase() {
  const hits = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'node_modules') walk(p); continue; }
      if (!/\.(m?js|jsx|ts|tsx)$/.test(entry.name) || SKIP_FILES.has(p)) continue;
      const text = fs.readFileSync(p, 'utf8');
      // A file that names the bucket AND calls Supabase Storage at all is
      // suspect, even if the bucket name is held in a variable.
      const namesBucket = /['"`]raider-videos['"`]/.test(text);
      text.split('\n').forEach((line, i) => {
        const direct = SUPABASE_USE_PATTERNS.some((re) => re.test(line));
        const indirect = namesBucket && /storage\s*\.from\(/.test(line);
        if (direct || indirect) hits.push(`${p}:${i + 1}  ${line.trim()}`);
      });
    }
  };
  CODE_DIRS.forEach(walk);
  return hits;
}

async function dbRowsWithSupabaseUrls(sb) {
  const { data, error } = await sb.from('raider_videos').select('id,title,storage_path');
  if (error) throw new Error(`could not read raider_videos: ${error.message}`);
  return data.filter((r) => /supabase\.co|\/storage\/v1\//i.test(r.storage_path || ''));
}

// Returns null if safe to delete, otherwise the reason it is not.
async function blockReason(env, row, sbSizes) {
  const size = Number(row.size_bytes);
  if (!COPIED.has(row.status)) return `migration status is "${row.status}"`;
  const inR2 = await r2Size(env, BUCKET, row.key);
  if (inR2 == null) return 'missing from R2';
  if (inR2 !== size) return `R2 size ${inR2} does not match log ${size}`;
  if (sbSizes.get(row.key) !== size) return `Supabase size ${sbSizes.get(row.key)} does not match log ${size}`;
  const backup = backupSize(BUCKET, row.key);
  if (backup !== size) return backup == null ? 'no local backup' : `backup size ${backup} does not match log ${size}`;
  return null;
}

const env = loadEnv();
const sb = supabaseAdmin(env);
console.log(`${really ? '' : '[DRY RUN] '}Clean up Supabase ${BUCKET} (files already in R2)\n`);

if (!fs.existsSync(MIGRATION_LOG)) {
  console.error(`No ${MIGRATION_LOG} found. Run scripts/migrate-raider-videos.mjs first.`);
  process.exit(1);
}

const codeHits = codeStillUsingSupabase();
if (codeHits.length) {
  console.error('STOP: code still uses the Supabase raider-videos bucket:');
  codeHits.forEach((h) => console.error(`  ${h}`));
  process.exit(1);
}
console.log('Code check: nothing in src/, supabase/functions/ or scripts/ uses the Supabase bucket.');

const badRows = await dbRowsWithSupabaseUrls(sb);
if (badRows.length) {
  console.error('STOP: these raider_videos rows store a Supabase URL:');
  badRows.forEach((r) => console.error(`  ${r.id}  ${r.title}  ${r.storage_path}`));
  process.exit(1);
}
console.log('DB check: no raider_videos row points at Supabase.\n');

const sbSizes = new Map((await listSupabase(sb, BUCKET)).map((o) => [o.key, o.size]));
const results = [];
const toDelete = [];
for (const row of readCsv(MIGRATION_LOG)) {
  if (!sbSizes.has(row.key)) {
    results.push({ key: row.key, size_bytes: row.size_bytes, result: 'already-gone' });
    console.log(`  gone  ${row.key}  (not in Supabase any more)`);
    continue;
  }
  const reason = await blockReason(env, row, sbSizes);
  if (reason) {
    results.push({ key: row.key, size_bytes: row.size_bytes, result: 'kept', reason });
    console.log(`  KEEP  ${row.key}  ${reason}`);
  } else {
    toDelete.push(row);
    console.log(`  ok    ${row.key}  ${mb(Number(row.size_bytes))}  verified in R2 + backup`);
  }
}
const unlogged = [...sbSizes.keys()].filter((k) => !results.some((r) => r.key === k) && !toDelete.some((r) => r.key === k));
unlogged.forEach((k) => console.log(`  KEEP  ${k}  not in the migration log (re-run the migrate script)`));

const freed = toDelete.reduce((n, r) => n + Number(r.size_bytes), 0);
console.log(`\n${toDelete.length} file(s) safe to delete, ${mb(freed)}. ${results.filter((r) => r.result === 'kept').length + unlogged.length} kept.`);

if (!really) {
  console.log('Dry run: nothing deleted. Re-run with --yes to delete.');
  process.exit(0);
}

for (let i = 0; i < toDelete.length; i += DELETE_BATCH) {
  const batch = toDelete.slice(i, i + DELETE_BATCH);
  const { error } = await sb.storage.from(BUCKET).remove(batch.map((r) => r.key));
  batch.forEach((r) => results.push({
    key: r.key, size_bytes: r.size_bytes,
    result: error ? 'delete-failed' : 'deleted', reason: error?.message || '',
  }));
  if (error) console.error(`  delete failed: ${error.message}`);
}

// Confirm against Supabase itself rather than trusting the API response.
const left = new Set((await listSupabase(sb, BUCKET)).map((o) => o.key));
for (const r of results) {
  if (r.result === 'deleted' && left.has(r.key)) { r.result = 'still-in-supabase'; }
}
writeCsv(CLEANUP_LOG, ['key', 'size_bytes', 'result', 'reason'], results);

const deleted = results.filter((r) => r.result === 'deleted').length;
console.log(`\nDeleted ${deleted} file(s) from Supabase. ${left.size} file(s) left in the Supabase bucket.`);
console.log(`Log written to ${CLEANUP_LOG}`);
if (results.some((r) => r.result === 'delete-failed' || r.result === 'still-in-supabase')) process.exit(1);
