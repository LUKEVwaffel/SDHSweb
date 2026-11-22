// The two steps every Supabase -> R2 bucket move uses. Each
// scripts/migrate-<bucket>.mjs and scripts/cleanup-<bucket>.mjs is a thin
// wrapper that passes its bucket names to these.
//
//   runMigration: back up every Supabase file locally, copy any file missing
//     from R2, write migration-log-<name>.csv. Never deletes anything.
//   runCleanup:   delete a Supabase file only after proving it is in R2, in
//     the local backup, unchanged, and not used by any code or DB row.

import fs from 'node:fs';
import path from 'node:path';
import {
  loadEnv, supabaseAdmin, listSupabase, listR2, r2Size, r2Put, r2ObjectUrl, inPool,
  backupPath, backupSize, downloadToBackup, supabaseObjectUrl, supabaseAuthHeaders,
  readCsv, writeCsv, mb,
} from './storageMigration.mjs';

const LOG_COLUMNS = ['key', 'size_bytes', 'content_type', 'status', 'backup_path', 'backup_source', 'error', 'checked_at'];
const COPIED = new Set(['already-in-r2', 'uploaded']);
const CONTENT_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.m4v': 'video/x-m4v',
};
const contentTypeFor = (obj) =>
  obj.contentType || CONTENT_TYPES[path.extname(obj.key).toLowerCase()] || 'application/octet-stream';

// Supabase's dashboard leaves these in "folders". They are not real files.
const isPlaceholder = (key) => path.basename(key) === '.emptyFolderPlaceholder';

/**
 * @param {object} o
 * @param {string} o.sbBucket   Supabase bucket to copy from
 * @param {string} o.r2Bucket   R2 bucket to copy into (same keys)
 * @param {string} o.logFile    CSV the cleanup step reads
 * @param {number} [o.concurrency]
 */
export async function runMigration({ sbBucket, r2Bucket, logFile, concurrency = 4 }) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const backupFromSupabase = args.includes('--backup-from-supabase');
  const env = loadEnv();
  const sb = supabaseAdmin(env);

  console.log(`${dryRun ? '[DRY RUN] ' : ''}Supabase ${sbBucket} -> R2 ${r2Bucket}`);
  const objects = (await listSupabase(sb, sbBucket)).filter((o) => !isPlaceholder(o.key));
  const inR2 = await listR2(env, r2Bucket);
  const total = objects.reduce((n, o) => n + o.size, 0);
  const missing = objects.filter((o) => inR2.get(o.key) !== o.size);
  console.log(`${objects.length} file(s) in Supabase, ${mb(total)}. Already in R2: ${objects.length - missing.length}. To copy: ${missing.length} (${mb(missing.reduce((n, o) => n + o.size, 0))}).\n`);

  async function ensureBackup(obj, isInR2) {
    if (backupSize(sbBucket, obj.key) === obj.size) return 'existing';
    const fromR2 = isInR2 && !backupFromSupabase;
    let written;
    if (fromR2) {
      const signed = await env.r2.sign(r2ObjectUrl(env, r2Bucket, obj.key), { method: 'GET' });
      written = await downloadToBackup(signed.url, Object.fromEntries(signed.headers), sbBucket, obj.key);
    } else {
      written = await downloadToBackup(supabaseObjectUrl(env, sbBucket, obj.key), supabaseAuthHeaders(env), sbBucket, obj.key);
    }
    if (written !== obj.size) throw new Error(`backup is ${written} bytes, expected ${obj.size}`);
    return fromR2 ? 'r2' : 'supabase';
  }

  async function migrateOne(obj) {
    const row = {
      key: obj.key, size_bytes: obj.size, content_type: contentTypeFor(obj),
      backup_path: path.relative(process.cwd(), backupPath(sbBucket, obj.key)),
      checked_at: new Date().toISOString(),
    };
    const isInR2 = inR2.get(obj.key) === obj.size;
    if (dryRun) {
      if (!isInR2) console.log(`  would copy  ${obj.key}  ${mb(obj.size)}`);
      return { ...row, status: 'dry-run' };
    }
    try {
      row.backup_source = await ensureBackup(obj, isInR2);
      if (isInR2) return { ...row, status: 'already-in-r2' };
      await r2Put(env, r2Bucket, obj.key, backupPath(sbBucket, obj.key), row.content_type);
      const after = await r2Size(env, r2Bucket, obj.key);
      if (after !== obj.size) throw new Error(`R2 has ${after} bytes after upload, expected ${obj.size}`);
      console.log(`  up    ${obj.key}  ${mb(obj.size)}`);
      return { ...row, status: 'uploaded' };
    } catch (e) {
      console.error(`  FAIL  ${obj.key}  ${e.message}`);
      return { ...row, status: 'failed', error: e.message };
    }
  }

  let done = 0;
  const rows = await inPool(objects, concurrency, async (obj) => {
    const r = await migrateOne(obj);
    done += 1;
    if (!dryRun && (done % 200 === 0 || done === objects.length)) console.log(`  ${done}/${objects.length} checked`);
    return r;
  });

  const failed = rows.filter((r) => r.status === 'failed').length;
  if (dryRun) {
    console.log('\nDry run: nothing uploaded, downloaded or logged.');
  } else {
    writeCsv(logFile, LOG_COLUMNS, rows);
    console.log(`\nLog written to ${logFile}`);
  }
  const tally = rows.reduce((t, r) => ({ ...t, [r.status]: (t[r.status] || 0) + 1 }), {});
  console.log(`Done. ${JSON.stringify(tally)}`);
  if (failed) {
    console.log('Re-run to retry failed files. Do not run cleanup until nothing fails.');
    process.exit(1);
  }
}

// ── cleanup ────────────────────────────────────────────────────────────────

// Code that would mean something still reads or writes the Supabase bucket.
// `.remove(` lines are fine: deleting from Supabase never depends on a file
// being there. Migration tooling itself is skipped.
function codeStillUsingSupabase(bucket) {
  const escaped = bucket.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const direct = [
    new RegExp(`storage\\s*\\.from\\(\\s*['"\`]${escaped}['"\`]\\s*\\)`),
    new RegExp(`storage/v1/object/(public/|sign/)?${escaped}/`),
  ];
  const namesBucket = new RegExp(`['"\`]${escaped}['"\`]`);
  const skip = (p) => /^scripts\/(migrate|cleanup)-/.test(p) || p.startsWith('scripts/lib/');
  const hits = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'node_modules') walk(p); continue; }
      if (!/\.(m?js|jsx|ts|tsx)$/.test(entry.name) || skip(p)) continue;
      const text = fs.readFileSync(p, 'utf8');
      const names = namesBucket.test(text);
      text.split('\n').forEach((line, i) => {
        if (/\.remove\(/.test(line)) return;
        if (direct.some((re) => re.test(line)) || (names && /storage\s*\.from\(/.test(line))) {
          hits.push(`${p}:${i + 1}  ${line.trim()}`);
        }
      });
    }
  };
  ['src', 'supabase/functions', 'scripts'].forEach(walk);
  return hits;
}

// Every DB column (all tables the API can see) holding a URL to a file in
// this Supabase bucket. Returns Map(key -> ["table.column", ...]).
// change_log is skipped on purpose: it is history, not something the site
// loads.
async function dbReferences(env, sb, bucket, skipTables = ['change_log']) {
  const spec = await (await fetch(`${env.supabaseUrl}/rest/v1/`, { headers: supabaseAuthHeaders(env) })).json();
  const host = new URL(env.supabaseUrl).host.replace(/\./g, '\\.');
  const urlRe = new RegExp(`${host}/storage/v1/object/(?:public|sign)/${bucket.replace(/[-.]/g, '\\$&')}/([^"?\\s]+)`, 'g');
  const refs = new Map();
  for (const [table, def] of Object.entries(spec.definitions || {})) {
    if (skipTables.includes(table)) continue;
    for (const [col, c] of Object.entries(def.properties || {})) {
      if (!/text|character|json|\[\]/.test(`${c.format}`)) continue;
      const isText = /text|character/.test(`${c.format}`) && !/\[\]/.test(`${c.format}`);
      for (let from = 0; ; from += 1000) {
        let q = sb.from(table).select(col).not(col, 'is', null).range(from, from + 999);
        if (isText) q = q.ilike(col, `%/${bucket}/%`);
        const { data, error } = await q;
        if (error || !data) break;
        for (const r of data) {
          for (const m of JSON.stringify(r[col]).matchAll(urlRe)) {
            const key = decodeURIComponent(m[1].replace(/\\$/, ''));
            refs.set(key, [...new Set([...(refs.get(key) || []), `${table}.${col}`])]);
          }
        }
        if (data.length < 1000) break;
      }
    }
  }
  return refs;
}

/**
 * @param {object} o
 * @param {string} o.sbBucket
 * @param {string} o.r2Bucket
 * @param {string} o.logFile      migration log written by runMigration
 * @param {string} o.cleanupLog   CSV this run writes
 */
export async function runCleanup({ sbBucket, r2Bucket, logFile, cleanupLog }) {
  const args = process.argv.slice(2);
  const really = args.includes('--yes') && !args.includes('--dry-run');
  const env = loadEnv();
  const sb = supabaseAdmin(env);
  console.log(`${really ? '' : '[DRY RUN] '}Clean up Supabase ${sbBucket} (files already in R2 ${r2Bucket})\n`);

  if (!fs.existsSync(logFile)) {
    console.error(`No ${logFile} found. Run the migrate script first.`);
    process.exit(1);
  }

  const codeHits = codeStillUsingSupabase(sbBucket);
  if (codeHits.length) {
    console.error(`STOP: code still uses the Supabase ${sbBucket} bucket:`);
    codeHits.forEach((h) => console.error(`  ${h}`));
    process.exit(1);
  }
  console.log(`Code check: nothing in src/, supabase/functions/ or scripts/ uses the Supabase bucket.`);

  const refs = await dbReferences(env, sb, sbBucket);
  console.log(`DB check: ${refs.size} file(s) in this bucket are still used by a DB row. Those are kept.\n`);

  const sbSizes = new Map((await listSupabase(sb, sbBucket)).map((o) => [o.key, o.size]));
  const r2Sizes = await listR2(env, r2Bucket);
  const logRows = readCsv(logFile);
  const logged = new Set(logRows.map((r) => r.key));
  const results = [];
  const toDelete = [];
  const keep = (key, size, reason) => {
    results.push({ key, size_bytes: size, result: 'kept', reason });
    console.log(`  KEEP  ${key}  ${reason}`);
  };

  for (const row of logRows) {
    const size = Number(row.size_bytes);
    if (!sbSizes.has(row.key)) { results.push({ key: row.key, size_bytes: size, result: 'already-gone' }); continue; }
    let reason = null;
    if (!COPIED.has(row.status)) reason = `migration status is "${row.status}"`;
    else if (r2Sizes.get(row.key) == null) reason = 'missing from R2';
    else if (r2Sizes.get(row.key) !== size) reason = `R2 size ${r2Sizes.get(row.key)} does not match log ${size}`;
    else if (sbSizes.get(row.key) !== size) reason = `Supabase size ${sbSizes.get(row.key)} does not match log ${size}`;
    else if (backupSize(sbBucket, row.key) !== size) reason = backupSize(sbBucket, row.key) == null ? 'no local backup' : 'backup size does not match log';
    else if (refs.has(row.key)) reason = `still used by ${refs.get(row.key).join(', ')}`;
    if (reason) keep(row.key, size, reason);
    else toDelete.push(row);
  }
  for (const [key, size] of sbSizes) {
    if (!logged.has(key) && !isPlaceholder(key)) keep(key, size, 'not in the migration log (re-run the migrate script)');
  }

  const freed = toDelete.reduce((n, r) => n + Number(r.size_bytes), 0);
  const kept = results.filter((r) => r.result === 'kept').length;
  console.log(`\n${toDelete.length} file(s) safe to delete, ${mb(freed)}. ${kept} kept.`);
  if (!really) {
    console.log('Dry run: nothing deleted. Re-run with --yes to delete.');
    return;
  }

  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100);
    const { error } = await sb.storage.from(sbBucket).remove(batch.map((r) => r.key));
    batch.forEach((r) => results.push({
      key: r.key, size_bytes: r.size_bytes, result: error ? 'delete-failed' : 'deleted', reason: error?.message || '',
    }));
    if (error) console.error(`  delete failed: ${error.message}`);
    else console.log(`  deleted ${Math.min(i + 100, toDelete.length)}/${toDelete.length}`);
  }

  // Confirm against Supabase itself rather than trusting the API response.
  const left = new Set((await listSupabase(sb, sbBucket)).map((o) => o.key));
  for (const r of results) if (r.result === 'deleted' && left.has(r.key)) r.result = 'still-in-supabase';
  writeCsv(cleanupLog, ['key', 'size_bytes', 'result', 'reason'], results);

  const deleted = results.filter((r) => r.result === 'deleted').length;
  console.log(`\nDeleted ${deleted} file(s) from Supabase. ${left.size} file(s) left in the Supabase bucket.`);
  console.log(`Log written to ${cleanupLog}`);
  if (results.some((r) => r.result === 'delete-failed' || r.result === 'still-in-supabase')) process.exit(1);
}
