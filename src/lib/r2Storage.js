import { supabase as SB } from './supabaseClient';
import { invokeError } from './supabaseFnError';

// Drop-in replacement for the subset of supabase.storage.from(BUCKET) that
// the 5 egress-driver buckets actually use (upload/getPublicUrl/remove) — see
// r2-migration project memory for why: R2's secret key can't ship to the
// browser, so writes go through the r2-presign edge function while reads hit
// the r2-media-reader Worker directly (no auth needed, it's public media).
// Public read base (not a secret). Falls back to the Worker's workers.dev URL
// so a deploy missing VITE_R2_MEDIA_BASE still serves media instead of
// "undefined/..." links. Flip the env var to media.sdhsjrotc.com once that
// zone is active.
const R2_MEDIA_BASE = import.meta.env.VITE_R2_MEDIA_BASE || 'https://r2-media-reader.sdhs-battalion.workers.dev';

async function presign(bucket, key, method, contentType) {
  const { data, error } = await SB.functions.invoke('r2-presign', {
    body: { bucket, key, method, contentType },
  });
  if (error || !data?.url) {
    throw new Error(await invokeError(data, error, 'could not get upload URL'));
  }
  return data.url;
}

export function r2PublicUrl(bucket, path) {
  return `${R2_MEDIA_BASE}/${bucket}/${path}`;
}

export function r2GetPublicUrl(bucket, path) {
  return { data: { publicUrl: r2PublicUrl(bucket, path) } };
}

export async function r2Upload(bucket, path, file, { contentType } = {}) {
  const type = contentType || file.type || 'application/octet-stream';
  const url = await presign(bucket, path, 'PUT', type);
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': type }, body: file });
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
  return { data: { path }, error: null };
}

export async function r2Remove(bucket, paths) {
  await Promise.all(paths.map(async (path) => {
    const url = await presign(bucket, path, 'DELETE');
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`delete failed (${res.status})`);
  }));
  return { data: null, error: null };
}
