// Shared: is this address an HCDE school inbox? Those don't reliably receive
// outside mail and a student loses access after leaving, so every Ball signer
// (cadet + guest) must give a personal address instead. Mirrored server-side
// in supabase/functions/ball-submit-signup/index.ts.
export const SCHOOL_EMAIL_DOMAINS = ['students.hcde.org', 'hcde.org'];

export function isSchoolEmail(email) {
  const at = (email || '').toLowerCase().lastIndexOf('@');
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return SCHOOL_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}
