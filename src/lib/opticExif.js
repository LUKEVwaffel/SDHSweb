import { parse as parseExif } from 'exifr';

/**
 * Read the real capture time off a photo's EXIF, before resize/HEIC-convert
 * strips it. Call this on the ORIGINAL File the user picked — never on a
 * resized/converted copy, which carries no EXIF at all.
 *
 * DateTimeOriginal has no timezone in EXIF; OffsetTimeOriginal (when present)
 * gives the camera's UTC offset at capture. Without it we take the camera's
 * local wall-clock reading at face value (Date treats "no offset" as local to
 * THIS device, which is wrong when the device time zone differs from the
 * venue) — acceptable here since optic_retag_photos only compares taken_at
 * against sub-event windows written from the same camera on the same day, in
 * the same time zone. camera_offset_seconds in optic_config corrects camera
 * clock drift, not time zone.
 *
 * @param {File} file
 * @returns {Promise<string|null>} ISO timestamp, or null if the file has no
 *          EXIF capture time (screenshots, some Android exports, re-saves).
 */
export async function readTakenAt(file) {
  try {
    const exif = await parseExif(file, ['DateTimeOriginal', 'OffsetTimeOriginal']);
    const dt = exif?.DateTimeOriginal;
    if (!dt || Number.isNaN(dt.getTime?.())) return null;

    const offset = exif?.OffsetTimeOriginal; // e.g. "-04:00"
    if (offset && /^[+-]\d{2}:\d{2}$/.test(offset)) {
      // exifr already parsed DateTimeOriginal as a local Date with no offset
      // applied; rebuild it as UTC using the EXIF fields directly so the
      // offset can be applied correctly instead of double-adjusting.
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      const hh = String(dt.getHours()).padStart(2, '0');
      const mm = String(dt.getMinutes()).padStart(2, '0');
      const ss = String(dt.getSeconds()).padStart(2, '0');
      return `${y}-${m}-${d}T${hh}:${mm}:${ss}${offset}`;
    }
    return dt.toISOString();
  } catch {
    return null; // no EXIF block, corrupt segment, or unsupported format
  }
}
