import { supabase as SB } from './supabaseClient';
import { resizeForUpload } from './imageResize';

const BUCKET = 'tv-team-photos';

// Admin-curated per-team + Battalion folders that feed the /tv kiosk's
// "Team Photos" mode (see useTvCarouselPhotos.js) — distinct from the public
// submission pool in photos_hub_v2.sql. See supabase/tv_photos.sql for the
// table/bucket/RLS this talks to.
export async function listTvPhotos(folder) {
  const { data, error } = await SB.from('tv_photos')
    .select('id,folder,photo_url,storage_path,created_at')
    .eq('folder', folder)
    .order('created_at', { ascending: false });
  return { photos: data || [], error };
}

export async function uploadTvPhoto(folder, file, uploadedBy) {
  const { full } = await resizeForUpload(file);
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  const { error: uploadError } = await SB.storage.from(BUCKET).upload(path, full, { upsert: true, contentType: 'image/jpeg' });
  if (uploadError) return { error: uploadError };

  const { data: pub } = SB.storage.from(BUCKET).getPublicUrl(path);
  const { data, error } = await SB.from('tv_photos')
    .insert({ folder, storage_path: path, photo_url: pub.publicUrl, uploaded_by: uploadedBy || null })
    .select('id,folder,photo_url,storage_path,created_at')
    .single();
  return { photo: data, error };
}

export async function deleteTvPhoto(id, storagePath) {
  const { error: rowError } = await SB.from('tv_photos').delete().eq('id', id);
  if (rowError) return { error: rowError };
  const { error: storageError } = await SB.storage.from(BUCKET).remove([storagePath]);
  return { error: storageError };
}
