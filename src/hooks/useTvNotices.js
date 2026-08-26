import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

/**
 * All tv_notices rows (both categories) for one screen, realtime-synced.
 * Callers filter by `category` client-side — same "one table, filter in the
 * component" shape TvShoutoutsPanel.jsx already uses for bday vs manual.
 * Refetches the full list on any insert/update/delete rather than patching
 * state locally — the list is small (staff-typed announcements, not a firehose),
 * so simplicity wins over an in-memory reducer.
 */
export function useTvNotices(screenSlug = 'range') {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => (
    SB.from('tv_notices').select('*').eq('screen_slug', screenSlug)
      .order('created_at', { ascending: false })
      .then(({ data }) => setNotices(data || []))
  ), [screenSlug]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    refetch().then(() => { if (alive) setLoading(false); });

    // Supabase reuses the channel object when `.channel()` is called again
    // with a topic that's already subscribed (see useTvDailySettings.js for
    // the same guard) — so if a stale instance for this topic is still
    // registered (e.g. a fast unmount/remount before its own cleanup landed),
    // drop it before creating a fresh one instead of calling `.on()` on an
    // already-subscribed channel.
    const topic = `tv-notices-live:${screenSlug}`;
    const stale = SB.getChannels().find((c) => c.topic === `realtime:${topic}`);
    if (stale) SB.removeChannel(stale);

    const channel = SB.channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tv_notices', filter: `screen_slug=eq.${screenSlug}` },
        () => { if (alive) refetch(); }
      )
      .subscribe();

    return () => { alive = false; SB.removeChannel(channel); };
  }, [screenSlug, refetch]);

  return { notices, loading };
}
