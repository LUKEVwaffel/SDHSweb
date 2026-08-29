// Client-side HEIC/HEIF -> JPEG conversion for the public /rhea upload flow.
// iPhones on default camera settings save HEIC, which the browser's
// <img>/canvas pipeline (used by resizeForUpload) cannot decode. Converting in
// the browser first lets an iPhone parent post straight from their camera roll
// with no camera-settings change and no extra taps.
//
// heic2any bundles libheif (~1.3MB) and runs on the main thread, so it is
// loaded lazily (dynamic import) — only a device that actually drops a HEIC
// file ever downloads it, and JPG/PNG uploads are untouched.

const HEIC_MIME = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);
const HEIC_EXT = /\.(heic|heif)$/i;

/**
 * True when a picked file looks like HEIC/HEIF. iOS frequently hands the file
 * picker a HEIC with an empty or generic MIME type, so the extension is a
 * required fallback, not a nicety.
 * @param {File} file
 */
export function isHeic(file) {
  if (!file) return false;
  const type = (file.type || '').toLowerCase();
  if (HEIC_MIME.has(type)) return true;
  const generic = type === '' || type === 'application/octet-stream';
  return generic && HEIC_EXT.test(file.name || '');
}

/**
 * Convert one HEIC/HEIF File to a JPEG File. The result is a plain
 * image/jpeg File that goes through the exact same upload path as a photo the
 * user picked as JPG — no special-casing downstream.
 *
 * Live Photos / burst frames arrive as HEIC *sequences*; heic2any returns an
 * array of blobs for those, and we keep the first (the still frame).
 *
 * @param {File} file
 * @returns {Promise<File>} a new image/jpeg File
 * @throws if the file cannot be decoded (corrupt, unsupported variant, etc.)
 */
export async function convertHeicToJpeg(file) {
  const { default: heic2any } = await import('heic2any');
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  const blob = Array.isArray(out) ? out[0] : out;
  if (!blob || !blob.size) throw new Error('HEIC conversion produced no image');
  const name = `${(file.name || 'photo').replace(HEIC_EXT, '')}.jpg`;
  return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified || Date.now() });
}
