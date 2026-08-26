import { useState, useEffect } from 'react';
import { supabase as SB } from '../lib/supabaseClient';
import { byLastName } from '../lib/nameSort.js';

/**
 * Cadets in `company` still missing DD Form 3203 or the JROTC Personal
 * Datasheet (both due Aug 31) — powers the Welcome screen's reminder list.
 * Declined counts as "turned in" (the parent actively responded); only
 * `pending`/null on either form means still outstanding. Reads
 * `cadet_consent_due_status`, a public-safe view exposing just name/company/
 * the two due-date statuses — cadet_consent itself is authenticated-only
 * (see cadet_consent_due_status_view.sql).
 */
export function useTvConsentDue(company) {
  const [pending, setPending] = useState([]);

  useEffect(() => {
    let alive = true;
    SB.from('cadet_consent_due_status').select('name, company, dd3203_status, datasheet_status')
      .eq('company', (company || '').toLowerCase())
      .then(({ data }) => {
        if (!alive) return;
        const outstanding = (data || [])
          .filter((c) => c.dd3203_status !== 'collected' && c.dd3203_status !== 'declined'
            || c.datasheet_status !== 'collected' && c.datasheet_status !== 'declined')
          .map((c) => c.name)
          .sort(byLastName);
        setPending(outstanding);
      });
    return () => { alive = false; };
  }, [company]);

  return pending;
}
