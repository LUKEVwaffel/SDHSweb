export const RAIDER_BUCKET = 'team-photos';

export const RCATS = [
  { key: 'funny', label: 'FUNNY', field: 'votes_funny' },
  { key: 'aura',  label: 'AURA',  field: 'votes_aura' },
  { key: 'team',  label: 'TEAM',  field: 'votes_team' },
];

// Default poll close = 24h after the event date, at 20:00 local, as datetime-local string.
export function defaultCloses(eventDate) {
  const base = eventDate ? new Date(`${eventDate}T00:00`) : new Date();
  base.setDate(base.getDate() + 1);
  base.setHours(20, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
}
