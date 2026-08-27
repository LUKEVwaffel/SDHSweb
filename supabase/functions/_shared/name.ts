// Display-name helper for the Ball signup lookups. cadet_consent.name is one
// free-text field (no separate first/middle/last columns), and most cadets
// enter "First Middle Last" — but a real subset of the roster has a
// two-word Hispanic surname instead of a middle name (e.g. "Cristopher
// Trujillo Arevalo" = first name "Cristopher" + surname "Trujillo Arevalo",
// NOT a middle name to drop). Blindly keeping only the first+last word would
// cut those cadets' actual surname in half, so they're carried here as an
// explicit exception list and shown in full.
//
// Only used by ball-lookup-cadet and ball-search-roster — the LOOKUP/SEARCH
// display, per product decision. ball-submit-signup re-fetches the cadet
// independently and stores the untouched full cadet_consent.name as the
// official ball_signups.cadet_name record (S-6/ops need the real legal name
// for payment + field-trip-form tracking, not the shortened display form).
//
// Curated against the current roster (cadet_consent_birthdates.sql). Add a
// name here if a future cadet or SDHS-guest match has the same two-word
// compound-surname pattern and starts getting incorrectly shortened.
const COMPOUND_SURNAME_FULL_NAMES = new Set([
  'cristopher trujillo arevalo',
  'itzel maravilla santes',
  'alisson roman castro',
  'santiago solano salcedo',
  'surisley gutierrez pineiro',
  'cinthia sanchez garfias',
]);

export function displayName(fullName: string | null | undefined): string {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length <= 2) return trimmed;
  if (COMPOUND_SURNAME_FULL_NAMES.has(trimmed.toLowerCase())) return trimmed;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}
