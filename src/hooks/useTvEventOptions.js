import { useState, useEffect } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

const NY_TZ = 'America/New_York';

function todayNy() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: NY_TZ }).format(new Date());
}

/** Past, posted events for the given team ids — the "pick a past event's photos" source list. */
export function useTvEventOptions(teamIds) {
  const [events, setEvents] = useState([]);
  const key = (teamIds || []).slice().sort().join(',');

  useEffect(() => {
    let alive = true;
    let q = SB.from('events').select('id,title,date,team').eq('status', 'posted').lte('date', todayNy());
    if (teamIds && teamIds.length) q = q.in('team', teamIds);
    q.order('date', { ascending: false }).limit(40).then(({ data }) => {
      if (alive) setEvents(data || []);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the stable serialization of teamIds, refetch on its value not array identity
  }, [key]);

  return events;
}
