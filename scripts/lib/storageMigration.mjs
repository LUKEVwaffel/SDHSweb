// Shared helpers for the Supabase Storage -> Cloudflare R2 migration scripts
// (scripts/migrate-*.mjs and scripts/cleanup-*.mjs). One place for env
// loading, the R2 client, listing, the CSV log and local backups, so each
// per-bucket script stays short.
//
// Env comes from .env.migrate (gitignored), loaded with `node --env-file`:
//   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY

import { createClient } from '@supabase/supabase-js';
import { AwsClient } from 'aws4fetch';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const BACKUP_ROOT = path.resolve('storage-backup');
export const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const REQUIRED_ENV = [
  'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
  'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY',
];

export function loadEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env: ${missing.join(', ')}`);
    console.error('Run with: node --env-file=.env.migrate scripts/<script>.mjs');
    process.exit(1);
  }
  const env = Object.fromEntries(REQUIRED_ENV.map((k) => [k, process.env[k].trim()]));
  return {
    supabaseUrl: env.VITE_SUPABASE_URL.replace(/\/+$/, ''),
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    r2Endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    r2: new AwsClient({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      service: 's3',
      region: 'auto',
    }),
  };
}

export function supabaseAdmin(env) {
  return createClient(env.supabaseUrl, env.serviceKey, { auth: { persistSession: false } });
}

export const encodeKey = (key) => key.split('/').map(encodeURIComponent).join('/');

export const r2ObjectUrl = (env, bucket, key) => `${env.r2Endpoint}/${bucket}/${encodeKey(key)}`;

// Every object in a Supabase bucket, walking folders. Returns
// [{ key, size, contentType }].
export async function listSupabase(sb, bucket, prefix = '') {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`Supabase list ${bucket}/${prefix}: ${error.message}`);
    for (const item of data) {
      const key = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) out.push(...await listSupabase(sb, bucket, key)); // folder
      else out.push({ key, size: Number(item.metadata?.size), contentType: item.metadata?.mimetype || '' });
    }
    if (data.length < 1000) return out;
  }
}

const xmlDecode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// R2 size for a key, or null if the object is not there. Uses a list call
// rather than HEAD on purpose: these buckets have Sippy turned on, so a HEAD
// on a missing key makes R2 go ask Supabase, and the answer comes back as a
// confusing 403. Listing only ever looks at what is really in R2.
export async function r2Size(env, bucket, key) {
  const url = new URL(`${env.r2Endpoint}/${bucket}`);
  url.searchParams.set('list-type', '2');
  url.searchParams.set('prefix', key);
  url.searchParams.set('max-keys', '50');
  const res = await env.r2.fetch(url);
  if (!res.ok) throw new Error(`R2 list ${bucket}/${key}: HTTP ${res.status}`);
  const xml = await res.text();
  for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    if (xmlDecode(m[1].match(/<Key>([\s\S]*?)<\/Key>/)[1]) === key) {
      return Number(m[1].match(/<Size>(\d+)<\/Size>/)[1]);
    }
  }
  return null;
}

export async function r2Put(env, bucket, key, filePath, contentType) {
  const res = await env.r2.fetch(r2ObjectUrl(env, bucket, key), {
    method: 'PUT',
    body: fs.readFileSync(filePath),
    headers: {
      'content-type': contentType,
      'cache-control': CACHE_CONTROL,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    },
  });
  if (!res.ok) throw new Error(`R2 PUT ${bucket}/${key}: HTTP ${res.status} ${await res.text()}`);
}

export const backupPath = (bucket, key) => path.join(BACKUP_ROOT, bucket, key);

// Size of the local backup, or null if there is none.
export function backupSize(bucket, key) {
  try { return fs.statSync(backupPath(bucket, key)).size; } catch { return null; }
}

// Stream a download to the backup folder (via a .partial file so a crash
// never leaves a half file that looks finished). Returns bytes written.
export async function downloadToBackup(url, headers, bucket, key) {
  const dest = backupPath(bucket, key);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`download ${key}: HTTP ${res.status}`);
  const tmp = `${dest}.partial`;
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
  fs.renameSync(tmp, dest);
  return fs.statSync(dest).size;
}

export const supabaseObjectUrl = (env, bucket, key) =>
  `${env.supabaseUrl}/storage/v1/object/${bucket}/${encodeKey(key)}`;

export const supabaseAuthHeaders = (env) => ({
  Authorization: `Bearer ${env.serviceKey}`,
  apikey: env.serviceKey,
});

// ── CSV log ─────────────────────────────────────────────────────────────────
const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function writeCsv(file, columns, rows) {
  const lines = [columns.join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))];
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
}

export function readCsv(file) {
  const [header, ...lines] = fs.readFileSync(file, 'utf8').trim().split('\n');
  const columns = header.split(',');
  return lines.map((line) => {
    const cells = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (quoted && ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
      else if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    return Object.fromEntries(columns.map((c, i) => [c, cells[i] ?? '']));
  });
}

export const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;
