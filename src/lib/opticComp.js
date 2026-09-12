import { supabase as SB } from './supabaseClient';
import { resizeForUpload } from './imageResize';
import { adminDisplayName } from './admins';

// ── OPTIC 2.0 — comp photo pipeline. Which event this targets is no longer a
// hardcoded id: useOpticConfig() reads it from optic_config.active_event_id so
// swapping to the next comp is a DB row, not a code change. OPTIC_EVENT_ID
// below is only the pre-config fallback (and what legacy dormant surfaces —
// RaiderCarousel, TvCongratsScreen, compPhotoVote, raiderCompGallery — still
// import directly; those aren't part of the live feed and stay pinned to this
// one comp until they're revisited).
export const OPTIC_EVENT_ID = 'e8a305fe-86cf-4092-a580-5865423271b9';
export const OPTIC_EVENT_TITLE = 'Spring Hill HS Raider Challenge';

const BUCKET = 'team-photos';
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

const RAIDER_TEAM_LABEL = { male: 'Male Raiders', coed: 'Coed Raiders', both: 'Raiders' };
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
  const { full, thumb } = await resizeForUpload(file); // throws on RAW / unreadable
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const base = `${PHOTO_TEAM}/${eventId}/${stamp}`;

  const up1 = await SB.storage.from(BUCKET).upload(`${base}.jpg`, full, { contentType: 'image/jpeg' });
  if (up1.error) throw up1.error;
  const up2 = await SB.storage.from(BUCKET).upload(`${base}_t.jpg`, thumb, { contentType: 'image/jpeg' });
  if (up2.error) throw up2.error;

  const photoUrl = SB.storage.from(BUCKET).getPublicUrl(`${base}.jpg`).data.publicUrl;
  const thumbUrl = SB.storage.from(BUCKET).getPublicUrl(`${base}_t.jpg`).data.publicUrl;

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

/**
 * Force a real download (Save) of a cross-origin storage image. A plain
 * <a download> is ignored cross-origin and just opens the file in a tab.
 * Desktop/Android path only — iOS has no reliable cross-origin blob download,
 * see lib/opticSave.js for the Web Share / long-press fallback used in Reel.
 */
export async function downloadPhoto(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = obj;
    a.download = filename || url.split('/').pop() || 'photo.jpg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(obj), 4000);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}
