// Turn whatever a cadet typed into the school-email box into the bare
// username the roster lookup expects. Kids type (or iOS autofills) the full
// address, so "jsmith@students.hcde.org" → "jsmith". Returns null for a
// different domain (gmail etc.) so the form can say "use your school email"
// instead of it resolving to someone else's school account. Normalize on
// submit, not per keystroke — stripping at "@" while typing ate the domain one
// char at a time ("jsmith@s" → "jsmiths"). Mirrored server-side in
// supabase/functions/_shared/schoolEmail.ts.
export const SCHOOL_DOMAIN = '@students.hcde.org';

export function normalizeSchoolUsername(raw) {
  let v = String(raw || '').trim().toLowerCase().replace(/\s+/g, '');
  const at = v.indexOf('@');
  if (at >= 0) {
    if (v.slice(at) !== SCHOOL_DOMAIN) return null;
    v = v.slice(0, at);
  }
  return v || null;
}
