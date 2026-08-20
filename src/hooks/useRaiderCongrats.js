import { useState, useEffect } from 'react';
import { supabase as SB } from '../lib/supabaseClient';
import { teamsForName, displayNameForName } from '../lib/raiderRoster.js';

/**
 * Cross-references the official Raider roster (src/lib/raiderRoster.js)
 * against the full cadet roster by name, so Range TV can congratulate
 * whichever cadets made the team on their own company's (or staff's) screen
 * without hand-maintaining a second roster-to-company mapping.
 *
 * Reads `cadet_company_roster`, not `personnel` — personnel is only the
 * ~33-person leadership directory. The real ~154-cadet roster with company
 * assignments lives in `cadet_consent`, which is admin-locked (consent
 * status, emails, birthdates); cadet_company_roster is a narrow public view
 * over it exposing just name + company. See
 * supabase/cadet_company_roster_view.sql.
 */
export function useRaiderCongrats() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    SB.from('cadet_company_roster').select('name, company')
      .then(({ data }) => {
        if (!alive) return;
        const found = (data || [])
          .map((c) => ({ name: displayNameForName(c.name), company: (c.company || '').toLowerCase(), teams: teamsForName(c.name) }))
          .filter((c) => c.teams.length > 0);
        setMatches(found);
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  return { matches, loading };
}

export function matchesForCompany(matches, companyId) {
  const company = (companyId || '').toLowerCase();
  return matches.filter((m) => m.company === company);
}

export function matchesForStaff(matches) {
  return matches.filter((m) => m.company === 'staff');
}
