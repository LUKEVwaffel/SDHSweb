import { useState, useEffect } from 'react';
import { supabase as SB } from '../lib/supabaseClient';
import { teamsForName } from '../lib/raiderRoster.js';

/**
 * Cross-references the official Raider roster (src/lib/raiderRoster.js)
 * against DISPATCH's `personnel` table by name, so Range TV can congratulate
 * whichever cadets made the team on their own company's (or staff's) screen
 * without hand-maintaining a second roster-to-company mapping.
 */
export function useRaiderCongrats() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    SB.from('personnel').select('name, section').eq('visible', true)
      .then(({ data }) => {
        if (!alive) return;
        const found = (data || [])
          .map((p) => ({ name: p.name, section: p.section, teams: teamsForName(p.name) }))
          .filter((p) => p.teams.length > 0);
        setMatches(found);
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  return { matches, loading };
}

// Non-company sections DISPATCH uses for battalion staff/command. Matches the
// actual `section` values seen in the personnel table (no hyphen in s1..s6,
// unlike PeoplePanel.jsx's SECTION_ORDER labels) — anyone here shows on the
// Staff screen instead of a company-welcome screen.
const STAFF_SECTIONS = new Set(['command', 'staff', 'leadership', 's1', 's2', 's3', 's4', 's5', 's6']);

export function matchesForCompany(matches, companyId) {
  const section = `company-${(companyId || '').toLowerCase()}`;
  return matches.filter((m) => m.section === section);
}

export function matchesForStaff(matches) {
  return matches.filter((m) => STAFF_SECTIONS.has(m.section));
}
