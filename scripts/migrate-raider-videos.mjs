// Copy every Raider TV video from Supabase Storage (`raider-videos`) to the
// R2 bucket of the same name, keeping the exact same file names. Also saves a
// local backup of every file and writes migration-log-raider-videos.csv,
// which scripts/cleanup-raider-videos.mjs reads before it deletes anything.
//
// This script NEVER deletes anything from Supabase.
//
// Safe to re-run: files already in R2 with the same size are not uploaded
// again, and backups that already exist with the right size are not
// downloaded again.
//
// Backups: a file already in R2 is backed up FROM R2 by default (same bytes,
// and it does not use up Supabase's monthly egress). Pass
// --backup-from-supabase to pull every backup from Supabase instead. Files
// not yet in R2 always come from Supabase.
//
// Usage (from the repo root):
//   node --env-file=.env.migrate scripts/migrate-raider-videos.mjs --dry-run
//   node --env-file=.env.migrate scripts/migrate-raider-videos.mjs

import path from 'node:path';
import {
  loadEnv, supabaseAdmin, listSupabase, r2Size, r2Put, r2ObjectUrl,
  backupPath, backupSize, downloadToBackup, supabaseObjectUrl, supabaseAuthHeaders,
  writeCsv, mb,
} from './lib/storageMigration.mjs';

const BUCKET = 'raider-videos';
const LOG_FILE = 'migration-log-raider-videos.csv';
const LOG_COLUMNS = ['key', 'size_bytes', 'content_type', 'status', 'backup_path', 'backup_source', 'error', 'checked_at'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const backupFromSupabase = args.includes('--backup-from-supabase');

const CONTENT_TYPES = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.m4v': 'video/x-m4v' };
const contentTypeFor = (obj) =>
  obj.contentType || CONTENT_TYPES[path.extname(obj.key).toLowerCase()] || 'application/octet-stream';

const env = loadEnv();
const sb = supabaseAdmin(env);

// Make sure a correct local backup exists. Returns where it came from.
async function ensureBackup(obj, inR2) {
  if (backupSize(BUCKET, obj.key) === obj.size) return 'existing';
  const fromR2 = inR2 && !backupFromSupabase;
  const written = fromR2
    ? await downloadToBackup(...(await signedR2Get(obj.key)), BUCKET, obj.key)
    : await downloadToBackup(supabaseObjectUrl(env, BUCKET, obj.key), supabaseAuthHeaders(env), BUCKET, obj.key);
  if (written !== obj.size) throw new Error(`backup is ${written} bytes, expected ${obj.size}`);
  return fromR2 ? 'r2' : 'supabase';
}

async function signedR2Get(key) {
  const signed = await env.r2.sign(r2ObjectUrl(env, BUCKET, key), { method: 'GET' });
  return [signed.url, Object.fromEntries(signed.headers)];
}

async function migrateOne(obj) {
  const row = {
    key: obj.key, size_bytes: obj.size, content_type: contentTypeFor(obj),
    backup_path: path.relative(process.cwd(), backupPath(BUCKET, obj.key)),
    checked_at: new Date().toISOString(),
  };
  const existing = await r2Size(env, BUCKET, obj.key);
  const inR2 = existing === obj.size;

  if (dryRun) {
    const action = inR2 ? 'already in R2, would back up only' : existing == null ? 'would upload' : `R2 size differs (${existing}), would re-upload`;
    console.log(`  ${obj.key}  ${mb(obj.size)}  ${action}`);
    return { ...row, status: 'dry-run' };
  }

  row.backup_source = await ensureBackup(obj, inR2);
  if (inR2) {
    console.log(`  ok    ${obj.key}  ${mb(obj.size)}  already in R2 (backup: ${row.backup_source})`);
    return { ...row, status: 'already-in-r2' };
  }

  await r2Put(env, BUCKET, obj.key, backupPath(BUCKET, obj.key), row.content_type);
  const after = await r2Size(env, BUCKET, obj.key);
  if (after !== obj.size) throw new Error(`R2 has ${after} bytes after upload, expected ${obj.size}`);
  console.log(`  up    ${obj.key}  ${mb(obj.size)}  uploaded to R2`);
  return { ...row, status: 'uploaded' };
}

console.log(`${dryRun ? '[DRY RUN] ' : ''}Supabase ${BUCKET} -> R2 ${BUCKET}`);
const objects = await listSupabase(sb, BUCKET);
const total = objects.reduce((n, o) => n + o.size, 0);
console.log(`${objects.length} file(s) in Supabase, ${mb(total)}\n`);

const rows = [];
for (const obj of objects) {
  try {
    rows.push(await migrateOne(obj));
  } catch (e) {
    console.error(`  FAIL  ${obj.key}  ${e.message}`);
    rows.push({ key: obj.key, size_bytes: obj.size, status: 'failed', error: e.message, checked_at: new Date().toISOString() });
  }
}

const failed = rows.filter((r) => r.status === 'failed').length;
if (dryRun) {
  console.log('\nDry run: nothing uploaded, downloaded or logged.');
} else {
  writeCsv(LOG_FILE, LOG_COLUMNS, rows);
  console.log(`\nLog written to ${LOG_FILE}`);
}
console.log(`Done. ${rows.length - failed} ok, ${failed} failed.`);
if (failed) {
  console.log('Re-run the script to retry failed files. Do not run cleanup until every row is ok.');
  process.exit(1);
}
