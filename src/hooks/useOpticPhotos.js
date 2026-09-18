import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

const SELECT = '*, raider_sub_events(name, team)';
const FALLBACK_POLL_MS = 60_000; // socket can silently drop over a 12h day
const DEBOUNCE_MS = 350;
const TOP_THRESHOLD_PX = 48;

const capturedAt = (p) => new Date(p.taken_at || p.created_at).getTime();
const sortNewestFirst = (rows) => rows.slice().sort((a, b) => capturedAt(b) - capturedAt(a));
const isAtTop = () => typeof window === 'undefined' || window.scrollY <= TOP_THRESHOLD_PX;

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
 * @param {boolean} [opts.deferMidScroll]  when true, a background
 *        realtime/poll refresh that would reorder the newest-first list is
 *        held back instead of applied immediately while the reader is
 *        scrolled away from the top — new photos sort to index 0, so
 *        applying them mid-scroll shoves everything already on screen down
 *        and reads as the feed "glitching"/restarting (Spring Hill survey
 *        report, 2026-09-18: "scrolling through the photos halfway down, it
 *        would glitch and start over"). `pendingCount`/`showNew` below let
 *        the caller surface a "N new" affordance instead. The reader's own
 *        explicit refresh() call always applies immediately regardless —
 *        only the passive background tick defers. Off by default: the
 *        admin gallery (/lukepwa) and the TV display both want instant,
 *        undeferred updates, not a tap-to-reveal pill.
 */
export function useOpticPhotos({ eventId, scope = 'public', enabled = true, deferMidScroll = false } = {}) {
  const [photos, setPhotos] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const aliveRef = useRef(true);
  const photosRef = useRef([]);
  const pendingRef = useRef(null);
  const active = enabled && !!eventId;

  const commit = useCallback((list) => {
    photosRef.current = list;
    pendingRef.current = null;
    setPendingCount(0);
    setPhotos(list);
  }, []);

  const fetchRows = useCallback(async () => {
    let q = SB.from('photos').select(SELECT).eq('event_id', eventId);
    if (scope === 'public') q = q.eq('visibility', 'public').eq('status', 'live');
    const { data, error: qErr } = await q;
    return qErr ? { rows: null, qErr } : { rows: sortNewestFirst(data || []), qErr: null };
  }, [eventId, scope]);

  // Direct load: mount, eventId/scope change, or the consumer's own
  // refresh() — always commits immediately.
  const load = useCallback(async () => {
    const { rows, qErr } = await fetchRows();
    if (!aliveRef.current) return;
    if (qErr) { setError(qErr.message || String(qErr)); setLoading(false); return; }
    setError(null);
    commit(rows);
    setLoading(false);
  }, [fetchRows, commit]);

  // Passive load: realtime tick or the fallback poll. Subject to
  // deferMidScroll — see the opts doc above.
  const backgroundLoad = useCallback(async () => {
    const { rows, qErr } = await fetchRows();
    if (!aliveRef.current) return;
    if (qErr) { setError(qErr.message || String(qErr)); return; }
    setError(null);
    if (!deferMidScroll || isAtTop()) { commit(rows); return; }
    const knownIds = new Set(photosRef.current.map((p) => p.id));
    pendingRef.current = rows;
    setPendingCount(rows.filter((p) => !knownIds.has(p.id)).length);
  }, [fetchRows, commit, deferMidScroll]);

  const showNew = useCallback(() => {
    if (pendingRef.current) commit(pendingRef.current);
  }, [commit]);

  const scheduleLoad = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(backgroundLoad, DEBOUNCE_MS);
  }, [backgroundLoad]);

  useEffect(() => {
    aliveRef.current = true;
    if (!active) {
      setPhotos([]); photosRef.current = []; pendingRef.current = null; setPendingCount(0); setLoading(false);
      return () => { aliveRef.current = false; };
    }

    setLoading(true);
    load();

    const channel = SB.channel(`optic-photos-${scope}-${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'photos', filter: `event_id=eq.${eventId}` },
        scheduleLoad,
      )
      .subscribe();

    const pollId = setInterval(backgroundLoad, FALLBACK_POLL_MS);

    // If the reader scrolls back to the top themselves (rather than tapping
    // the "N new" pill), apply whatever landed while they were reading
    // instead of making them wait for the next realtime tick or the 60s
    // fallback poll to notice they're back at the top.
    let onScroll;
    if (deferMidScroll) {
      onScroll = () => { if (pendingRef.current && isAtTop()) showNew(); };
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      clearInterval(pollId);
      if (onScroll) window.removeEventListener('scroll', onScroll);
      SB.removeChannel(channel);
    };
  }, [eventId, scope, active, load, backgroundLoad, scheduleLoad, deferMidScroll, showNew]);

  return { photos, loading, error, pendingCount, showNew, refresh: load };
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
