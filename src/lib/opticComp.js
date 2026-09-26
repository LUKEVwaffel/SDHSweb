import { supabase as SB } from './supabaseClient';
import { resizeForUpload } from './imageResize';
import { adminDisplayName } from './admins';
import { putPhotoFile } from './photoStorage';

// ── OPTIC 2.0 — comp photo pipeline. Which event this targets is no longer a
// hardcoded id: useOpticConfig() reads it from optic_config.active_event_id so
// swapping to the next comp is a DB row, not a code change. OPTIC_EVENT_ID
// below is only the pre-config fallback (and what legacy dormant surfaces —
// RaiderCarousel, TvCongratsScreen, compPhotoVote, raiderCompGallery — still
// import directly; those aren't part of the live feed and stay pinned to this
// one comp until they're revisited). Bumped 2026-09-18 from Spring Hill ->
// East Hamilton (comp 2026-09-19) — id/title match the `events` row Luke
// created in DISPATCH's Events tab, and optic_config.active_event_id got the
// same bump so the live /optic feed points here too.
export const OPTIC_EVENT_ID = '0d0eef63-eff6-4988-bc4a-b9686ccc9dd4';
export const OPTIC_EVENT_TITLE = 'East Hamilton Raider Competition';

// Feed-card image size. The feed renders `thumb_url`, full-width on a
// phone, so it needs more than the 400px gallery default to look sharp.
const FEED_THUMB_MAX = 900;
// photos.team MUST stay 'raiders' , the photos_require_posted_event trigger
// rejects any other value for this event. Sub-team goes in raider_team.
const PHOTO_TEAM = 'raiders';

// Input-level allow list. JPG/PNG only, on purpose: the admin bulk-upload
// path currently mishandles .CR2 and can leave partial rows. Restricting the
// input sidesteps RAW entirely for tonight rather than fixing decode.
export const ACCEPT_ATTR = 'image/jpeg,image/png';
// /optic only: also let iPhone parents pick HEIC/HEIF straight from the camera
// roll. Those are converted to JPEG in the browser (see lib/heicConvert.js)
// before they hit the upload pipeline. Extensions are listed alongside the
// MIME types because iOS often reports HEIC files with no usable type.
export const OPTIC_ACCEPT_ATTR =
  'image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif';
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png']);

export function isAllowedImage(file) {
  if (ALLOWED_TYPES.has(file.type)) return true;
  // Some browsers leave .jpg/.jpeg/.png with an empty type , fall back to ext.
  const ext = file.name.split('.').pop()?.toLowerCase();
  return !file.type && ['jpg', 'jpeg', 'png'].includes(ext || '');
}

export const REJECT_MESSAGE =
  'Only JPG and PNG files are accepted. iPhone photos saved as HEIC will not upload , ' +
  'set Settings › Camera › Formats to "Most Compatible", or send a screenshot of the photo instead.';

// `.in('id', [...])` puts every id in the request URL (~40 chars per uuid),
// and the Supabase gateway rejects URLs past roughly 8KB. A few hundred ids
// (SELECT ALL -> PUBLISH on a full comp, or Luke's whole-card publish landing
// on every viewer at once) is enough to hit that, so id lists go out in
// chunks of this size.
export const ID_CHUNK = 100;
export function chunkIds(ids, size = ID_CHUNK) {
  const list = [...ids];
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const RAIDER_TEAM_LABEL ={ male: 'Male Raiders', coed: 'Coed Raiders', both: 'Raiders' };
export const raiderTeamLabel = (t) => RAIDER_TEAM_LABEL[t] || null;

/**
 * Resize + upload one image and insert its photos row.
 * @param {File} file
 * @param {object} opts
 * @param {'parent'|'luke'} opts.source
 * @param {string} [opts.uploaderName]  free-text attribution (optional both paths)
 * @param {string|null} [opts.deviceFp] device fingerprint , parent path only,
 *        left null for Luke so his 50+ dump is never rate-limited
 * @param {string} opts.eventId  target event, from useOpticConfig(). Required,
 *        no fallback to OPTIC_EVENT_ID: this must never silently reattach a
 *        new photo to a past comp.
 * @param {string|null} [opts.takenAt]  ISO capture time read from EXIF before
 *        resize/HEIC-convert strips it (see lib/opticExif.js). null when the
 *        file carries no EXIF.
 * @param {'male'|'coed'|'both'|null} [opts.raiderTeam]  team tag, picked by a
 *        parent or by Luke from the "current station" selector in LukeUpload
 * @param {string|null} [opts.subEventId]  sub-event to tag at upload time
 *        (Luke's "current station" picker), so a batch doesn't need a
 *        separate LukePwa tagging pass afterward
 * @param {boolean} [opts.publish]  Luke-only: true skips the staged review
 *        step and publishes straight to the live feed. Ignored for parent
 *        uploads, which are always public immediately regardless.
 * @returns {Promise<object>} the inserted photos row
 */
export async function uploadOpticPhoto(file, {
  source, uploaderName = '', deviceFp = null, eventId,
  takenAt = null, raiderTeam = null, subEventId = null, publish = false,
}) {
  if (!eventId) throw new Error('No active event set. optic_config.active_event_id is missing.');
  // throws on RAW / unreadable
  const { full, thumb } = await resizeForUpload(file, { thumbMax: FEED_THUMB_MAX });
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const base = `${PHOTO_TEAM}/${eventId}/${stamp}`;

  // R2 when configured, Supabase Storage otherwise — see lib/photoStorage.js.
  const [photoUrl, thumbUrl] = await Promise.all([
    putPhotoFile(`${base}.jpg`, full),
    putPhotoFile(`${base}_t.jpg`, thumb),
  ]);

  const { data, error } = await SB.from('photos').insert({
    team: PHOTO_TEAM,
    event_id: eventId,
    storage_path: `${base}.jpg`,
    photo_url: photoUrl,
    thumb_url: thumbUrl,
    uploader_name: uploaderName.trim() || null,
    uploader_fp: source === 'luke' ? null : deviceFp,
    source,
    visibility: source === 'luke' ? (publish ? 'public' : 'staged') : 'public',
    upload_status: 'done',
    taken_at: takenAt || null,
    ...(raiderTeam ? { raider_team: raiderTeam } : {}),
    ...(subEventId ? { sub_event_id: subEventId } : {}),
  }).select('*, raider_sub_events(name, team)').single();
  if (error) throw error;
  return data;
}

/**
 * Feed attribution line for one photo row.
 *  - Luke's published photos  -> "Luke , Team Photographer"
 *  - parent with a name       -> that name
 *  - parent, no name          -> "Parent"
 */
export function feedAttribution(photo) {
  if (photo.source === 'luke') {
    return adminDisplayName(photo.uploaded_by) === 'Luke' || !photo.uploaded_by
      ? 'Luke , Team Photographer'
      : `${adminDisplayName(photo.uploaded_by)} , Team Photographer`;
  }
  return photo.uploader_name?.trim() || 'Parent';
}

/** Tag chip text, or null when the photo has no team/sub-event tag. */
export function feedChip(photo) {
  const sub = photo.raider_sub_events?.name?.trim();
  const team = raiderTeamLabel(photo.raider_team);
  if (sub && team) return `${team} · ${sub}`;
  return sub || team || null;
}

const OPTIC_ONBOARDED_KEY = 'optic_onboarded_v2';
const OPTIC_WALKTHROUGH_KEY = 'optic_walkthrough_v2';

/** True once the visitor finished (or skipped) the /optic first-run flow here. */
export function hasOnboardedOptic() {
  try { return localStorage.getItem(OPTIC_ONBOARDED_KEY) === '1'; } catch { return false; }
}

/** Mark the /optic first-run flow done on this device. */
export function markOnboardedOptic() {
  try { localStorage.setItem(OPTIC_ONBOARDED_KEY, '1'); } catch { /* private mode */ }
}

/** True once the in-app walkthrough (post-install tour) has run on this device. */
export function hasWalkthroughOptic() {
  try { return localStorage.getItem(OPTIC_WALKTHROUGH_KEY) === '1'; } catch { return false; }
}

/** Mark the in-app walkthrough seen on this device. */
export function markWalkthroughOptic() {
  try { localStorage.setItem(OPTIC_WALKTHROUGH_KEY, '1'); } catch { /* private mode */ }
}

const OPTIC_INSTALL_DISMISSED_KEY = 'optic_install_dismissed';

/** True once the visitor has dismissed the "add to home screen" nudge in the feed. */
export function hasInstallDismissedOptic() {
  try { return localStorage.getItem(OPTIC_INSTALL_DISMISSED_KEY) === '1'; } catch { return false; }
}

/** Mark the "add to home screen" nudge dismissed on this device. */
export function markInstallDismissedOptic() {
  try { localStorage.setItem(OPTIC_INSTALL_DISMISSED_KEY, '1'); } catch { /* private mode */ }
}

const OPTIC_WATCHZONE_DISMISSED_KEY = 'optic_watchzone_dismissed';

/** True once the visitor has dismissed the Watching Zone nudge in the feed. */
export function hasWatchZoneDismissedOptic() {
  try { return localStorage.getItem(OPTIC_WATCHZONE_DISMISSED_KEY) === '1'; } catch { return false; }
}

/** Mark the Watching Zone nudge dismissed on this device. */
export function markWatchZoneDismissedOptic() {
  try { localStorage.setItem(OPTIC_WATCHZONE_DISMISSED_KEY, '1'); } catch { /* private mode */ }
}

// ── likes ─────────────────────────────────────────────────────────────────
// One like per photo per device. `deviceFp` is the same FingerprintJS +
// localStorage-nonce string used for upload rate-limiting. The visible count
// lives on photos.like_count (kept current by a DB trigger), so the feed hook
// gets it with no extra query , these two helpers only manage THIS device's
// own like rows.

/** The set of photo ids this device has already liked. */
export async function fetchMyLikes(deviceFp) {
  if (!deviceFp) return new Set();
  const { data, error } = await SB
    .from('rhea_photo_likes')
    .select('photo_id')
    .eq('device_fp', deviceFp);
  if (error) return new Set();
  return new Set((data || []).map((r) => r.photo_id));
}

/** Add or remove this device's like on one photo. Throws on failure. */
export async function setLike(photoId, deviceFp, liked) {
  if (!photoId || !deviceFp) throw new Error('missing photo or device id');
  if (liked) {
    const { error } = await SB
      .from('rhea_photo_likes')
      .upsert({ photo_id: photoId, device_fp: deviceFp }, { onConflict: 'photo_id,device_fp', ignoreDuplicates: true });
    if (error) throw error;
  } else {
    const { error } = await SB
      .from('rhea_photo_likes')
      .delete()
      .eq('photo_id', photoId)
      .eq('device_fp', deviceFp);
    if (error) throw error;
  }
}

const IOS_UA = /iphone|ipad|ipod/i;
const isIosDevice = () => IOS_UA.test(window.navigator.userAgent) && !window.MSStream;
// Web Share's own cancel signal ("user tapped Cancel/X on the share sheet")
// vs. an actual failure — conflating them means a deliberate cancel falls
// through to opening a tab the user never asked for. Chrome and Safari both
// reject with this DOMException name on cancel.
const isShareCancel = (err) => err?.name === 'AbortError';

// Saves an already-fetched blob without touching Web Share — the desktop
// `<a download>` hack, or (iOS, which has no working blob download at all)
// the real-URL long-press fallback. Kept separate from downloadPhoto() so
// downloadPhotos()'s per-item fallback can call this directly instead of
// re-fetching every photo a second time and re-opening a share sheet once
// per photo if only single-file share (not multi-file) turns out supported.
function saveBlobDirect(blob, name, url) {
  if (isIosDevice()) {
    window.open(url, '_blank', 'noopener');
    return;
  }
  const obj = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = obj;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(obj), 4000);
}

/**
 * Save a cross-origin storage image to the device. iOS Safari has no
 * working blob download at all: `<a download>` on a blob: URL is silently
 * ignored, and clicking it just navigates to a QuickLook-style document
 * preview with no image render and no "Save Image" option (confirmed live
 * via a parent screenshot, 2026-09-19 - this was the exact bug behind the
 * Spring Hill survey's "tried to save a photo and it just opened a new tab"
 * report; the earlier fix attempt never actually shipped). Web Share's file
 * support is the one path on iOS that reaches "Save to Photos", so it's
 * tried first everywhere it's available (Android shares it too); the
 * `<a download>` hack is the fallback for browsers where it actually works
 * (desktop Chrome/Firefox/Edge).
 */
export async function downloadPhoto(url, filename) {
  const name = filename || url.split('/').pop() || 'photo.jpg';
  let blob;
  try {
    const res = await fetch(url);
    blob = await res.blob();
  } catch {
    window.open(url, '_blank', 'noopener');
    return;
  }

  const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      if (isShareCancel(err)) return; // backed out on purpose, leave it alone
    }
  }

  saveBlobDirect(blob, name, url);
}

// ── batch save ────────────────────────────────────────────────────────────
// Two steps on purpose. iOS only lets navigator.share() run inside a fresh
// user tap ("transient activation", a few seconds at most). The old one-shot
// downloadPhotos() fetched every selected photo FIRST and only then called
// share(), so on any real selection the tap had long expired, share() threw
// NotAllowedError, and the per-photo fallback (window.open on iOS) got
// popup-blocked — batch save "did nothing" (parent reports after East
// Hamilton). Now: prepareBatch() fetches with a progress count, the UI flips
// to a SAVE button, and saveBatchChunk() calls share() synchronously off
// that second tap with the files already in memory.
//
// iOS's share sheet also gets unreliable with a lot of full-size images in
// one go, so saves go out in chunks of BATCH_CHUNK — one tap each.
export const BATCH_CHUNK = 20;
const MOBILE_UA = /iphone|ipad|ipod|android/i;
const isMobile = () => MOBILE_UA.test(window.navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && /macintosh/i.test(navigator.userAgent)); // iPadOS reports as Mac

/**
 * Fetch every selected photo into memory. Resolves to the items that loaded
 * (failed fetches are dropped and counted).
 * @param {Array<{id:string, photo_url:string}>} photos
 * @param {(done:number, total:number) => void} [onProgress]
 */
export async function prepareBatch(photos, onProgress) {
  const out = new Array(photos.length).fill(null);
  let done = 0;
  let next = 0;
  async function worker() {
    while (next < photos.length) {
      const i = next++;
      const p = photos[i];
      try {
        const res = await fetch(p.photo_url);
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const name = `optic_${p.id}.jpg`;
        out[i] = { blob, name, url: p.photo_url, file: new File([blob], name, { type: blob.type || 'image/jpeg' }) };
      } catch { /* dropped, reported via failed count */ }
      done += 1;
      onProgress?.(done, photos.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, photos.length) }, worker));
  const items = out.filter(Boolean);
  return { items, failed: photos.length - items.length };
}

/**
 * Save one chunk of prepared items. MUST be called directly from a click
 * handler (no awaits before it) so iOS still counts the tap.
 * @returns {Promise<'saved'|'cancelled'|'failed'>}
 */
export async function saveBatchChunk(items) {
  if (!items.length) return 'failed';
  const files = items.map((r) => r.file);
  if (isMobile() && navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files });
      return 'saved';
    } catch (err) {
      if (isShareCancel(err)) return 'cancelled';
      // iOS has no working fallback (window.open per photo is popup-blocked),
      // so report it and let the UI suggest a smaller chunk / single saves.
      if (isIosDevice()) return 'failed';
    }
  }
  for (let i = 0; i < items.length; i += 1) {
    saveBlobDirect(items[i].blob, items[i].name, items[i].url);
    // Staggered so the browser doesn't treat a same-tick burst as a popup flood.
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return 'saved';
}
