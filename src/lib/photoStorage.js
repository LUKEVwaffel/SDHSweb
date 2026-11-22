import { supabase as SB } from './supabaseClient';

// ── Where photo files live: the optic-photos Cloudflare Worker / R2 bucket
// (see workers/optic-r2/). Every upload goes there. R2 has zero egress fees,
// so a few hundred parents scrolling the feed no longer burn the Supabase
// quota (the quota blew on 2026-09-26 and got the project restricted).
//
// VITE_OPTIC_R2_URL must be set (Vercel and .env.local). Without it uploads
// fail with a clear message instead of quietly writing to Supabase again.
//
// Rows don't record which backend they're on; the URL does. Photos still on
// the old Supabase `team-photos` bucket keep their Supabase URLs, render as
// before, and are deleted from Supabase by removePhotoFiles.
const LEGACY_BUCKET = 'team-photos';
const R2_BASE = (import.meta.env.VITE_OPTIC_R2_URL || '').trim().replace(/\/+$/, '');
const NOT_CONFIGURED = 'Photo storage is not set up (VITE_OPTIC_R2_URL is missing). Tell the S-6.';

export const r2Enabled = !!R2_BASE;

const isR2Url = (url) => !!R2_BASE && typeof url === 'string' && url.startsWith(`${R2_BASE}/`);

// A row's main file is a JPEG, or (parent videos, lib/opticVideo.js) a clip;
// its thumbnails are always <base>_t.jpg / <base>_s.jpg either way.
const MAIN_EXT_RE = /\.(jpg|mp4|mov|m4v|webm)$/i;

/** Storage key of a photo's small grid thumbnail: `<base>_s.jpg`. */
export const gridPathFor = (storagePath) => storagePath.replace(MAIN_EXT_RE, '_s.jpg');
/** Storage key of a photo's feed thumbnail (a video's poster): `<base>_t.jpg`. */
export const thumbPathFor = (storagePath) => storagePath.replace(MAIN_EXT_RE, '_t.jpg');

/** Public URL `path` has (or would have) once putPhotoFile uploads it. */
export function publicUrlFor(path) {
  if (!r2Enabled) throw new Error(NOT_CONFIGURED);
  return `${R2_BASE}/${path}`;
}

/** Upload one blob (a JPEG unless `contentType` says otherwise) at `path` and return its public URL. */
export async function putPhotoFile(path, blob, contentType = 'image/jpeg') {
  if (!r2Enabled) throw new Error(NOT_CONFIGURED);
  const res = await fetch(`${R2_BASE}/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
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
 * A row plus its sharp original, if a DISPATCH blur kept one under orig_*.
 * Pass this to removePhotoFiles when deleting a photo, or the unblurred
 * original stays public at its old URL.
 */
export const withOriginal = (p) => (p?.orig_storage_path
  ? [p, { storage_path: p.orig_storage_path, photo_url: p.orig_photo_url }]
  : [p]);

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
    const pair = [p.storage_path, thumbPathFor(p.storage_path)];
    (isR2Url(p.photo_url) ? r2Paths : sbPaths).push(...pair);
    // The grid thumb can live on a different backend than the photo (it may
    // have been backfilled to R2 for a photo still on Supabase).
    if (p.grid_url) (isR2Url(p.grid_url) ? r2Paths : sbPaths).push(gridPathFor(p.storage_path));
  }
  if (sbPaths.length) await SB.storage.from(LEGACY_BUCKET).remove(sbPaths);
  if (!r2Paths.length) return;

  const { data } = await SB.auth.getSession();
  const token = data?.session?.access_token;
  const results = await Promise.all(r2Paths.map((path) => fetch(`${R2_BASE}/${path}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then((r) => r.ok || r.status === 404).catch(() => false)));
  if (results.some((ok) => !ok)) throw new Error('Some photo files could not be deleted from R2.');
}
