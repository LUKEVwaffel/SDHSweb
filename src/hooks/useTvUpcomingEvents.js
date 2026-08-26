import { useState, useEffect, useCallback } from 'react';
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
 *
 * Realtime-synced like useTvNotices.js: a staff member posting, editing, or
 * cancelling an event refetches the whole list rather than patching state
 * locally (same "small list, simplicity wins" reasoning) — without this,
 * the Range kiosk's Upcoming Events slide and uniform-countdown picker only
 * ever reflected events as of whenever that component last mounted, not
 * what's actually posted right now.
 */
export function useTvUpcomingEvents(limit = 4, teamIds) {
  const [events, setEvents] = useState([]);
  const key = (teamIds || []).slice().sort().join(',');

  const refetch = useCallback(() => {
    let q = SB.from('events').select('id,title,date,event_time,team').eq('status', 'posted').gte('date', todayNy());
    if (teamIds && teamIds.length) {
      q = q.or(`team.in.(${teamIds.join(',')}),team.is.null`);
    }
    return q.order('date', { ascending: true }).limit(limit).then(({ data }) => data || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the stable serialization of teamIds, refetch on its value not array identity
  }, [limit, key]);

  useEffect(() => {
    let alive = true;
    refetch().then((data) => { if (alive) setEvents(data); });

    // Guard against the "cannot add postgres_changes callbacks... after
    // subscribe()" crash (see useTvDailySettings.js) — drop any stale
    // instance of this topic before subscribing fresh.
    const topic = `tv-upcoming-events-live:${limit}:${key}`;
    const stale = SB.getChannels().find((c) => c.topic === `realtime:${topic}`);
    if (stale) SB.removeChannel(stale);

    const channel = SB.channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        () => { refetch().then((data) => { if (alive) setEvents(data); }); }
      )
      .subscribe();

    return () => { alive = false; SB.removeChannel(channel); };
  }, [limit, key, refetch]);

  return events;
}
