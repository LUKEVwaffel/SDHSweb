import { supabase as SB } from './supabaseClient';
import { resizeForUpload } from './imageResize';

const BUCKET = 'tv-team-photos';

// Admin-curated per-team + Battalion folders that feed the /tv kiosk's
// "Team Photos" mode (see useTvCarouselPhotos.js) — distinct from the public
// submission pool in photos_hub_v2.sql. See supabase/tv_photos.sql for the
// table/bucket/RLS this talks to.
export async function listTvPhotos(folder) {
  const { data, error } = await SB.from('tv_photos')
    .select('id,folders,title,photo_url,storage_path,created_at')
    .contains('folders', [folder])
    .order('created_at', { ascending: false });
  return { photos: data || [], error };
}

// Storage-only half of upload — used before the per-photo assignment popup
// collects folders/title. Kept separate from insertTvPhoto so a cancelled
// popup can discard the file without ever creating a tv_photos row (the
// table has no UPDATE policy, so "upload now, assign later" would otherwise
// need one just for this flow).
export async function uploadTvPhotoFile(folder, file) {
  const { full } = await resizeForUpload(file);
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await SB.storage.from(BUCKET).upload(path, full, { upsert: true, contentType: 'image/jpeg' });
  if (error) return { error };
  const { data: pub } = SB.storage.from(BUCKET).getPublicUrl(path);
  return { storagePath: path, photoUrl: pub.publicUrl };
}

// Deletes the storage object only, no tv_photos row involved — for
// discarding a photo whose assignment popup was cancelled.
export async function deleteTvPhotoFile(storagePath) {
  const { error } = await SB.storage.from(BUCKET).remove([storagePath]);
  return { error };
}

export async function insertTvPhoto({ folders, title, storagePath, photoUrl, uploadedBy }) {
  const { data, error } = await SB.from('tv_photos')
    .insert({
      folders,
      title: title && title.trim() ? title.trim() : null,
      storage_path: storagePath,
      photo_url: photoUrl,
      uploaded_by: uploadedBy || null,
    })
    .select('id,folders,title,photo_url,storage_path,created_at')
    .single();
  return { photo: data, error };
}

export async function deleteTvPhoto(id, storagePath) {
  const { error: rowError } = await SB.from('tv_photos').delete().eq('id', id);
  if (rowError) return { error: rowError };
  const { error: storageError } = await SB.storage.from(BUCKET).remove([storagePath]);
  return { error: storageError };
}
