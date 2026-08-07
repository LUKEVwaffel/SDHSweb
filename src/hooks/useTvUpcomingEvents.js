import { useState, useEffect } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

const NY_TZ = 'America/New_York';

function todayNy() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: NY_TZ }).format(new Date());
}

/** Next few posted events, soonest first — powers the /tv "upcoming" ticker. */
export function useTvUpcomingEvents(limit = 4) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let alive = true;
    SB.from('events').select('id,title,date,team').eq('status', 'posted').gte('date', todayNy())
      .order('date', { ascending: true }).limit(limit)
      .then(({ data }) => { if (alive) setEvents(data || []); });
    return () => { alive = false; };
  }, [limit]);

  return events;
}
