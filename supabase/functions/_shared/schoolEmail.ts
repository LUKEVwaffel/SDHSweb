// Shared: turn whatever a cadet typed into the "school email" box into the
// bare username the roster lookup expects. Kids routinely type (or iOS
// autofills) the WHOLE address — "jsmith123@students.hcde.org" — plus stray
// spaces and auto-capitalization. The old lookups ran a strict
// /^[a-z0-9._-]+$/ check on the raw input, so a full address was rejected as
// "invalid" and surfaced as "we couldn't find a cadet with that email" even
// for cadets who were on the roster.
//
// Only the school domain is stripped. A different domain (gmail, etc.) is
// rejected rather than silently rewritten, so "jsmith@gmail.com" can never
// resolve to some other cadet's jsmith@students.hcde.org.
export const SCHOOL_DOMAIN = "@students.hcde.org";
const USERNAME_RE = /^[a-z0-9._-]{1,64}$/;

export function normalizeSchoolUsername(raw: unknown): string | null {
  let v = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, "");
  const at = v.indexOf("@");
  if (at >= 0) {
    if (v.slice(at) !== SCHOOL_DOMAIN) return null;
    v = v.slice(0, at);
  }
  return USERNAME_RE.test(v) ? v : null;
}
