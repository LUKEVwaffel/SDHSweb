import { supabase as SB } from './supabaseClient';

// ── Where OPTIC photo files live. When VITE_OPTIC_R2_URL is set (the
// optic-photos Cloudflare Worker, see workers/optic-r2/), new uploads go to
// R2 — zero egress fees, so a few hundred parents scrolling the feed no
// longer burn the Supabase egress quota (the quota blew on 2026-09-26 and
// got the project restricted). Unset, everything falls back to the old
// Supabase `team-photos` bucket, so a missing env var can never break
// uploads outright.
//
// Rows don't record which backend they're on; the URL does. Old photos keep
// their Supabase URLs and still render/delete exactly as before.
const BUCKET = 'team-photos';
const R2_BASE = (import.meta.env.VITE_OPTIC_R2_URL || '').trim().replace(/\/+$/, '');

export const r2Enabled = !!R2_BASE;

const isR2Url = (url) => !!R2_BASE && typeof url === 'string' && url.startsWith(`${R2_BASE}/`);

/** Upload one JPEG blob at `path` and return its public URL. */
export async function putPhotoFile(path, blob) {
  if (!r2Enabled) {
    const { error } = await SB.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw error;
    return SB.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }
  const res = await fetch(`${R2_BASE}/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob,
  });
  if (!res.ok) {
    let msg = `Upload failed (${res.status})`;
    try { msg = (await res.json()).error || msg; } catch { /* non-JSON body */ }
    throw new Error(msg);
  }
  return `${R2_BASE}/${path}`;
}

/**
 * Delete the full-size + thumbnail files behind each photos row, on
 * whichever backend each one lives. Best-effort per backend; throws only if
 * an R2 delete is refused (e.g. signed out).
 */
export async function removePhotoFiles(photos) {
  const sbPaths = [];
  const r2Paths = [];
  for (const p of photos) {
    if (!p?.storage_path) continue;
    const pair = [p.storage_path, p.storage_path.replace(/\.jpg$/i, '_t.jpg')];
    (isR2Url(p.photo_url) ? r2Paths : sbPaths).push(...pair);
  }
  if (sbPaths.length) await SB.storage.from(BUCKET).remove(sbPaths);
  if (!r2Paths.length) return;

  const { data } = await SB.auth.getSession();
  const token = data?.session?.access_token;
  const results = await Promise.all(r2Paths.map((path) => fetch(`${R2_BASE}/${path}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then((r) => r.ok || r.status === 404).catch(() => false)));
  if (results.some((ok) => !ok)) throw new Error('Some photo files could not be deleted from R2.');
}
