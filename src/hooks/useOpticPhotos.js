import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

const SELECT = '*, raider_sub_events(name, team)';
const FALLBACK_POLL_MS = 60_000; // socket can silently drop over a 12h day
const DEBOUNCE_MS = 350;

const capturedAt = (p) => new Date(p.taken_at || p.created_at).getTime();

/**
 * Live photo list for the OPTIC feed, kept current by a Supabase Realtime
 * subscription on `photos` filtered to one event (same postgres_changes
 * mechanism as DISPATCH chat). On any insert/update/delete for the event the
 * whole list is re-fetched (debounced) — the list is bounded to one event, so
 * a full refetch is cheaper than a correct client-side merge, and it picks up
 * the raider_sub_events join that the realtime payload does not carry.
 *
 * Sorted newest-capture-first: `taken_at` when EXIF gave one, else
 * `created_at` (upload time) — done client-side since Postgres can't express
 * "coalesce, then order by that" through the query builder cleanly here.
 *
 * @param {object} opts
 * @param {string} opts.eventId  from useOpticConfig() (live feed) or an
 *        archival OPTIC_EVENT_ID (a specific past comp's gallery/highlight
 *        surface) — always explicit, never defaulted, so a missing config
 *        can't silently pull up the wrong comp's photos.
 * @param {'public'|'all'} [opts.scope]  'public' = the /optic feed
 *        (visibility public + status live). 'all' = /lukepwa (everything,
 *        including staged and hidden).
 * @param {boolean} [opts.enabled]  gate the subscription (e.g. until auth).
 */
export function useOpticPhotos({ eventId, scope = 'public', enabled = true } = {}) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const aliveRef = useRef(true);
  const active = enabled && !!eventId;

  const load = useCallback(async () => {
    let q = SB.from('photos').select(SELECT).eq('event_id', eventId);
    if (scope === 'public') q = q.eq('visibility', 'public').eq('status', 'live');
    const { data, error: qErr } = await q;
    if (!aliveRef.current) return;
    if (qErr) { setError(qErr.message || String(qErr)); }
    else { setPhotos((data || []).slice().sort((a, b) => capturedAt(b) - capturedAt(a))); setError(null); }
    setLoading(false);
  }, [eventId, scope]);

  const scheduleLoad = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(load, DEBOUNCE_MS);
  }, [load]);

  useEffect(() => {
    aliveRef.current = true;
    if (!active) { setPhotos([]); setLoading(false); return () => { aliveRef.current = false; }; }

    setLoading(true);
    load();

    const channel = SB.channel(`optic-photos-${scope}-${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'photos', filter: `event_id=eq.${eventId}` },
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
  }, [eventId, scope, active, load, scheduleLoad]);

  return { photos, loading, error, refresh: load };
}

/**
 * Live sub-event list for the comp (realtime on raider_sub_events). Powers the
 * quick-select tagging list in /lukepwa.
 */
export function useOpticSubEvents({ eventId, enabled = true } = {}) {
  const [subEvents, setSubEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const aliveRef = useRef(true);
  const active = enabled && !!eventId;

  const load = useCallback(async () => {
    const { data } = await SB.from('raider_sub_events')
      .select('*').eq('event_id', eventId)
      .order('created_at', { ascending: true });
    if (!aliveRef.current) return;
    setSubEvents(data || []);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    aliveRef.current = true;
    if (!active) { setSubEvents([]); setLoading(false); return () => { aliveRef.current = false; }; }
    load();
    const channel = SB.channel(`optic-sub-events-${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'raider_sub_events', filter: `event_id=eq.${eventId}` },
        load,
      )
      .subscribe();
    return () => { aliveRef.current = false; SB.removeChannel(channel); };
  }, [eventId, active, load]);

  return { subEvents, loading, refresh: load };
}
