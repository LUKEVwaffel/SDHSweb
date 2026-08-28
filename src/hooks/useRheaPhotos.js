import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase as SB } from '../lib/supabaseClient';
import { RHEA_EVENT_ID } from '../lib/rheaComp';

const SELECT = '*, raider_sub_events(name, team)';
const FALLBACK_POLL_MS = 60_000; // socket can silently drop over a 12h day
const DEBOUNCE_MS = 350;

/**
 * Live photo list for the Rhea comp, kept current by a Supabase Realtime
 * subscription on `photos` filtered to this one event (same postgres_changes
 * mechanism as DISPATCH chat). On any insert/update/delete for the event the
 * whole list is re-fetched (debounced) — the list is bounded to one event, so
 * a full refetch is cheaper than a correct client-side merge, and it picks up
 * the raider_sub_events join that the realtime payload does not carry.
 *
 * @param {object} opts
 * @param {'public'|'all'} [opts.scope]  'public' = the /rhea feed
 *        (visibility public + status live). 'all' = /lukepwa (everything,
 *        including staged and hidden).
 * @param {boolean} [opts.enabled]  gate the subscription (e.g. until auth).
 */
export function useRheaPhotos({ scope = 'public', enabled = true } = {}) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const aliveRef = useRef(true);

  const load = useCallback(async () => {
    let q = SB.from('photos').select(SELECT).eq('event_id', RHEA_EVENT_ID);
    if (scope === 'public') q = q.eq('visibility', 'public').eq('status', 'live');
    q = q.order('created_at', { ascending: false });
    const { data, error: qErr } = await q;
    if (!aliveRef.current) return;
    if (qErr) { setError(qErr.message || String(qErr)); }
    else { setPhotos(data || []); setError(null); }
    setLoading(false);
  }, [scope]);

  const scheduleLoad = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(load, DEBOUNCE_MS);
  }, [load]);

  useEffect(() => {
    aliveRef.current = true;
    if (!enabled) { setLoading(false); return () => { aliveRef.current = false; }; }

    setLoading(true);
    load();

    const channel = SB.channel(`rhea-photos-${scope}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'photos', filter: `event_id=eq.${RHEA_EVENT_ID}` },
        scheduleLoad,
      )
      .subscribe();

    const pollId = setInterval(load, FALLBACK_POLL_MS);

    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      clearInterval(pollId);
      SB.removeChannel(channel);
    };
  }, [scope, enabled, load, scheduleLoad]);

  return { photos, loading, error, refresh: load };
}

/**
 * Live sub-event list for the comp (realtime on raider_sub_events). Powers the
 * quick-select tagging list in /lukepwa.
 */
export function useRheaSubEvents({ enabled = true } = {}) {
  const [subEvents, setSubEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const aliveRef = useRef(true);

  const load = useCallback(async () => {
    const { data } = await SB.from('raider_sub_events')
      .select('*').eq('event_id', RHEA_EVENT_ID)
      .order('created_at', { ascending: true });
    if (!aliveRef.current) return;
    setSubEvents(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    if (!enabled) { setLoading(false); return () => { aliveRef.current = false; }; }
    load();
    const channel = SB.channel('rhea-sub-events')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'raider_sub_events', filter: `event_id=eq.${RHEA_EVENT_ID}` },
        load,
      )
      .subscribe();
    return () => { aliveRef.current = false; SB.removeChannel(channel); };
  }, [enabled, load]);

  return { subEvents, loading, refresh: load };
}
