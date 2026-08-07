import { useState, useEffect } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

// Same page_content row About.jsx renders as "THE CREED" — single source,
// no new table needed for the /tv motto banner.
const FALLBACK = '"I will seek the mantle of leadership and stand prepared to uphold the Constitution and the American way of life."';

export function useBattalionCreed() {
  const [creed, setCreed] = useState(FALLBACK);

  useEffect(() => {
    let alive = true;
    SB.from('page_content').select('value').eq('key', 'battalion.creed').maybeSingle()
      .then(({ data }) => {
        if (alive && data?.value) setCreed(data.value);
      });
    return () => { alive = false; };
  }, []);

  return creed;
}
