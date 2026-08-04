import { adminDisplayName } from './admins';

// Unified attribution for both attribution sources: a DISPATCH admin upload
// (uploaded_by = the admin's login email, resolved to a display name — never
// the raw email) and a public/cadet submission (uploader_name = the freetext
// "credit" the submitter typed in). A DISPATCH upload can carry both, e.g. an
// admin uploading photos credited to a team parent.
export function getPhotoAttribution(photo) {
  const credit = photo.uploader_name?.trim() || null;
  const adminLabel = photo.uploaded_by ? adminDisplayName(photo.uploaded_by) : null;
  if (adminLabel && credit) return { primary: `Uploaded by ${adminLabel}`, secondary: `Photo by ${credit}` };
  if (adminLabel) return { primary: `Uploaded by ${adminLabel}`, secondary: null };
  if (credit) return { primary: `📷 ${credit}`, secondary: null };
  return { primary: null, secondary: null };
}
