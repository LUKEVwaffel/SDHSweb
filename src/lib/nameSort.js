// Sorts "First Last" (or "First Middle... Last") strings by last name, then
// first name. Neither `cadet_consent` nor `personnel` has a separate
// last-name column — only a single `name` field — so the last
// whitespace-separated token is treated as the surname. Multi-word surnames
// (e.g. "Trujillo Arevalo") sort on their final token only; there's no
// reliable way to detect a compound surname from a single free-text field.
export function lastNameFirstKey(name) {
  const parts = String(name || '').trim().split(/\s+/);
  if (parts.length < 2) return (name || '').toLowerCase();
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(' ');
  return `${last} ${first}`.toLowerCase();
}

export function byLastName(a, b) {
  return lastNameFirstKey(a).localeCompare(lastNameFirstKey(b));
}
