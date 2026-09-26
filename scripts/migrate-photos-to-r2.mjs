// One-off: copy every photo in public.photos that still lives in the Supabase
// `team-photos` bucket over to the `optic-photos` R2 bucket, then repoint the
// row's photo_url / thumb_url at the optic-photos Worker. Object paths stay
// identical, so photos.storage_path keeps meaning the same thing and
// lib/photoStorage.js routes later deletes to R2 by the new URL.
//
// Safe to re-run: rows already on R2 are skipped, and objects already in R2
// aren't uploaded twice. The Supabase copies are NOT deleted — do that by
// hand in the Supabase dashboard once you've checked the feed looks right.
//
// Each copy downloads the file from Supabase once, which counts toward
// Supabase egress one last time. If the project is restricted, downloads fail
// (HTTP 402/403) and the script stops early — nothing is changed for rows it
// couldn't copy.
//
// Usage (put the secrets in .env.local — never commit them):
//   node --env-file=.env --env-file=.env.local scripts/migrate-photos-to-r2.mjs --dry-run
//   node --env-file=.env --env-file=.env.local scripts/migrate-photos-to-r2.mjs
// Options: --dry-run  --event <event uuid>  --limit <n>
//
// Env:
//   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY   (R2 → Manage API tokens,
//     "Object Read & Write" on optic-photos)
//   VITE_OPTIC_R2_URL   the Worker URL, e.g. https://optic-photos.sdhs-battalion.workers.dev
//   R2_BUCKET           optional, defaults to optic-photos

import { createClient } from '@supabase/supabase-js';
import { AwsClient } from 'aws4fetch';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const argVal = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const onlyEvent = argVal('--event');
const limit = Number(argVal('--limit')) || Infinity;

const {
  VITE_SUPABASE_URL: sbUrl, SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  R2_ACCOUNT_ID: accountId, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey,
  VITE_OPTIC_R2_URL: r2PublicRaw, R2_BUCKET: bucket = 'optic-photos',
} = process.env;

const missing = Object.entries({
  VITE_SUPABASE_URL: sbUrl, SUPABASE_SERVICE_ROLE_KEY: serviceKey, R2_ACCOUNT_ID: accountId,
  R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey, VITE_OPTIC_R2_URL: r2PublicRaw,
}).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`Missing env: ${missing.join(', ')}`);
  process.exit(1);
}

const r2Public = r2PublicRaw.trim().replace(/\/+$/, '');
const r2Endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}`;
const s3 = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
const sb = createClient(sbUrl, serviceKey, { auth: { persistSession: false } });

const MARKER = '/storage/v1/object/public/team-photos/';
const CONCURRENCY = 6;
const encodeKey = (key) => key.split('/').map(encodeURIComponent).join('/');

// Path inside the bucket for a Supabase public URL, or null if it isn't one.
function bucketPath(url) {
  if (!url || !url.includes(MARKER)) return null;
  return decodeURIComponent(url.split(MARKER)[1].split('?')[0]);
}

async function existsInR2(key) {
  const res = await s3.fetch(`${r2Endpoint}/${encodeKey(key)}`, { method: 'HEAD' });
  return res.ok;
}

class FatalError extends Error {}

async function copyObject(sourceUrl, key) {
  if (await existsInR2(key)) return 'exists';
  const src = await fetch(sourceUrl);
  if (src.status === 402 || src.status === 403 || src.status === 429) {
    throw new FatalError(`Supabase refused the download (HTTP ${src.status}). Project is probably restricted.`);
  }
  if (!src.ok) throw new Error(`download ${src.status}`);
  const body = new Uint8Array(await src.arrayBuffer());
  const put = await s3.fetch(`${r2Endpoint}/${encodeKey(key)}`, {
    method: 'PUT',
    body,
    headers: {
      'Content-Type': src.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
  if (!put.ok) throw new Error(`R2 upload ${put.status}: ${(await put.text()).slice(0, 200)}`);
  return 'copied';
}

async function loadRows() {
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let q = sb.from('photos').select('id, event_id, photo_url, thumb_url')
      .like('photo_url', `%${MARKER}%`)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (onlyEvent) q = q.eq('event_id', onlyEvent);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows.slice(0, limit);
}

async function migrateRow(row) {
  const fullKey = bucketPath(row.photo_url);
  const thumbKey = bucketPath(row.thumb_url);
  if (!fullKey) return 'skipped';
  if (dryRun) return 'would-copy';

  await copyObject(row.photo_url, fullKey);
  if (thumbKey) await copyObject(row.thumb_url, thumbKey);

  const patch = { photo_url: `${r2Public}/${encodeKey(fullKey)}` };
  if (thumbKey) patch.thumb_url = `${r2Public}/${encodeKey(thumbKey)}`;
  const { error } = await sb.from('photos').update(patch).eq('id', row.id);
  if (error) throw new Error(`row update: ${error.message}`);
  return 'migrated';
}

async function main() {
  const rows = await loadRows();
  console.log(`${rows.length} photo row(s) still on Supabase Storage${onlyEvent ? ` for event ${onlyEvent}` : ''}.${dryRun ? ' (dry run)' : ''}`);
  if (!rows.length) return;

  const tally = { migrated: 0, 'would-copy': 0, skipped: 0, failed: 0 };
  const failures = [];
  let next = 0;
  let done = 0;
  let fatal = null;

  async function worker() {
    while (next < rows.length && !fatal) {
      const row = rows[next++];
      try {
        tally[await migrateRow(row)] += 1;
      } catch (err) {
        if (err instanceof FatalError) { fatal = err; return; }
        tally.failed += 1;
        failures.push(`${row.id}: ${err.message}`);
      }
      done += 1;
      if (done % 25 === 0 || done === rows.length) console.log(`  ${done}/${rows.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(tally);
  if (failures.length) console.log(`Failures:\n  ${failures.join('\n  ')}`);
  if (fatal) {
    console.error(`\nStopped early: ${fatal.message}\nRows not yet copied were left untouched; re-run once Supabase is back.`);
    process.exit(2);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
