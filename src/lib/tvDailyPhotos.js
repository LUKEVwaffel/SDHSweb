import { resizeForUpload } from './imageResize';
import { r2Upload, r2GetPublicUrl, r2Remove } from './r2Storage';

const BUCKET = 'tv-daily-photos';

// No thumb needed — this only ever feeds the full-bleed carousel, never a
// paginated grid, so skip the second resize pass the OPTIC pipeline does.
export async function uploadTvDailyPhoto(file) {
  const { full } = await resizeForUpload(file);
  const path = `default/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  await r2Upload(BUCKET, path, full, { contentType: 'image/jpeg' });
  const { data: pub } = r2GetPublicUrl(BUCKET, path);
  return pub.publicUrl;
}

// Removing a photo from the picker previously only dropped it from the local
// array, leaving the file sitting in storage forever. Recover the object
// path from the public URL and actually delete it.
export async function deleteTvDailyPhoto(url) {
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const path = url.slice(idx + marker.length);
  await r2Remove(BUCKET, [path]);
}
