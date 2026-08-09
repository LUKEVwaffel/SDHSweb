import { TEAMS } from './teams';

// Canonical folder order for the "no title, pick one" fallback — Battalion
// wins over "first assigned folder" when present because it reads as the
// broadest-scope catch-all caption, not an arbitrary team pick.
const FOLDER_LABELS = Object.fromEntries([
  ...TEAMS.map((t) => [t.id, t.label]),
  ['battalion', 'Battalion'],
]);
const FOLDER_ORDER = [...TEAMS.map((t) => t.id), 'battalion'];

// title if the admin set one, else a folder-derived label — used by both the
// TV Photos panel (live preview) and useTvCarouselPhotos.js (kiosk caption)
// so the two surfaces can never drift.
export function resolveTvPhotoCaption({ title, folders }) {
  if (title && title.trim()) return title.trim();
  const assigned = folders || [];
  if (assigned.includes('battalion')) return FOLDER_LABELS.battalion;
  const first = FOLDER_ORDER.find((id) => assigned.includes(id));
  return first ? FOLDER_LABELS[first] : 'Battalion';
}
