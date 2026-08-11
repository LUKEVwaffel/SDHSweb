import { useState, useEffect } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

const NY_TZ = 'America/New_York';

function todayNy() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: NY_TZ }).format(new Date());
}

/**
 * Next few posted events, soonest first — powers the /tv "upcoming" ticker
 * and the countdown band. `teamIds`, when non-empty, scopes to those teams'
 * events PLUS battalion-wide ones (`team is null`) — same "featured team(s)
 * union battalion" logic useTvCarouselPhotos.js already applies to photos.
 * `team` can't be matched with a plain `.in()` here because that never
 * matches NULL rows in Postgres, hence the explicit `.or()`.
 */
export function useTvUpcomingEvents(limit = 4, teamIds) {
  const [events, setEvents] = useState([]);
  const key = (teamIds || []).slice().sort().join(',');

  useEffect(() => {
    let alive = true;
    let q = SB.from('events').select('id,title,date,event_time,team').eq('status', 'posted').gte('date', todayNy());
    if (teamIds && teamIds.length) {
      q = q.or(`team.in.(${teamIds.join(',')}),team.is.null`);
    }
    q.order('date', { ascending: true }).limit(limit)
      .then(({ data }) => { if (alive) setEvents(data || []); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the stable serialization of teamIds, refetch on its value not array identity
  }, [limit, key]);

  return events;
}
