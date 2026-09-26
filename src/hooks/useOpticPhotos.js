import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

const SELECT = '*, raider_sub_events(name, team)';
const CHECK_POLL_MS = 120_000; // lightweight safety net, see checkForChanges()
const DEBOUNCE_MS = 350;
const TOP_THRESHOLD_PX = 48;

const capturedAt = (p) => new Date(p.taken_at || p.created_at).getTime();
const sortNewestFirst = (rows) => rows.slice().sort((a, b) => capturedAt(b) - capturedAt(a));
const isAtTop = () => typeof window === 'undefined' || window.scrollY <= TOP_THRESHOLD_PX;
const inPublicScope = (row) => row.visibility === 'public' && row.status === 'live';

/**
 * Live photo list for the OPTIC feed, kept current by a Supabase Realtime
 * subscription on `photos` filtered to one event (same postgres_changes
 * mechanism as DISPATCH chat).
 *
 * Bandwidth matters here — this hook blew the Supabase egress quota
 * (2026-09-26). It used to re-download the WHOLE list for every viewer on
 * every insert/update (each like is an update) plus a full refetch every 60s
 * per viewer; a few hundred rows x a few hundred phones x a comp day adds up
 * to tens of GB. Now:
 *  - realtime changes are applied incrementally from the payload itself.
 *    Only brand-new rows (which need the raider_sub_events join the payload
 *    doesn't carry) are fetched, batched by id.
 *  - the fallback poll only pulls `id, like_count` (a few KB) and does a full
 *    reload only if the set of ids actually changed. It runs every 2 min and
 *    only while the tab is visible, plus once when the phone comes back from
 *    the lock screen (iOS drops the socket in the background).
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
 * @param {boolean} [opts.deferMidScroll]  when true, a background change
 *        that would reorder the newest-first list (new photos) is held back
 *        instead of applied immediately while the reader is scrolled away
 *        from the top — new photos sort to index 0, so applying them
 *        mid-scroll shoves everything already on screen down and reads as the
 *        feed "glitching"/restarting (Spring Hill survey report, 2026-09-18).
 *        `pendingCount`/`showNew` below let the caller surface a "N new"
 *        affordance instead. In-place changes (like counts, tags) and
 *        removals always apply immediately. The reader's own explicit
 *        refresh() call always applies immediately regardless. Off by
 *        default: the admin gallery (/lukepwa) and the TV display both want
 *        instant, undeferred updates, not a tap-to-reveal pill.
 */
export function useOpticPhotos({ eventId, scope = 'public', enabled = true, deferMidScroll = false } = {}) {
  const [photos, setPhotos] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const aliveRef = useRef(true);
  const photosRef = useRef([]);
  const pendingRef = useRef(null);
  const newIdsRef = useRef(new Set()); // ids waiting on the batched join fetch
  const newTimerRef = useRef(null);
  const active = enabled && !!eventId;

  const commit = useCallback((list) => {
    photosRef.current = list;
    pendingRef.current = null;
    setPendingCount(0);
    setPhotos(list);
  }, []);

  // Route a reordering change through deferMidScroll.
  const applyReorder = useCallback((list) => {
    if (!deferMidScroll || isAtTop()) { commit(list); return; }
    const knownIds = new Set(photosRef.current.map((p) => p.id));
    pendingRef.current = list;
    setPendingCount(list.filter((p) => !knownIds.has(p.id)).length);
  }, [commit, deferMidScroll]);

  // Apply a non-reordering edit to both the on-screen list and any held-back
  // pending list, immediately.
  const applyInPlace = useCallback((edit) => {
    const next = edit(photosRef.current);
    if (next !== photosRef.current) { photosRef.current = next; setPhotos(next); }
    if (pendingRef.current) pendingRef.current = edit(pendingRef.current);
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

  // Full reload that respects deferMidScroll (used when the cheap check
  // finds the id set drifted, e.g. after the socket dropped).
  const backgroundLoad = useCallback(async () => {
    const { rows, qErr } = await fetchRows();
    if (!aliveRef.current) return;
    if (qErr) { setError(qErr.message || String(qErr)); return; }
    setError(null);
    const onScreen = new Set(photosRef.current.map((p) => p.id));
    const sameSet = rows.length === onScreen.size && rows.every((p) => onScreen.has(p.id));
    if (sameSet) commit(rows); else applyReorder(rows);
  }, [fetchRows, commit, applyReorder]);

  // Cheap safety net: ids + like counts only. Patches counts in place, and
  // falls back to a full reload only if photos were added or removed.
  const checkForChanges = useCallback(async () => {
    let q = SB.from('photos').select('id, like_count').eq('event_id', eventId);
    if (scope === 'public') q = q.eq('visibility', 'public').eq('status', 'live');
    const { data, error: qErr } = await q;
    if (!aliveRef.current || qErr || !data) return;
    const current = pendingRef.current || photosRef.current;
    const known = new Map(current.map((p) => [p.id, p]));
    const drifted = data.length !== known.size || data.some((r) => !known.has(r.id));
    if (drifted) { backgroundLoad(); return; }
    const counts = new Map(data.map((r) => [r.id, r.like_count]));
    applyInPlace((list) => (list.some((p) => counts.get(p.id) !== p.like_count)
      ? list.map((p) => (counts.get(p.id) !== p.like_count ? { ...p, like_count: counts.get(p.id) } : p))
      : list));
  }, [eventId, scope, backgroundLoad, applyInPlace]);

  const removeIds = useCallback((ids) => {
    applyInPlace((list) => (list.some((p) => ids.has(p.id)) ? list.filter((p) => !ids.has(p.id)) : list));
  }, [applyInPlace]);

  // New rows arrive without the raider_sub_events join; fetch them (batched
  // across a burst like Luke's 50-photo publish) and merge.
  const fetchNewRows = useCallback(async () => {
    const ids = [...newIdsRef.current];
    newIdsRef.current = new Set();
    if (!ids.length) return;
    let q = SB.from('photos').select(SELECT).in('id', ids);
    if (scope === 'public') q = q.eq('visibility', 'public').eq('status', 'live');
    const { data, error: qErr } = await q;
    if (!aliveRef.current || qErr) return;
    const incoming = new Map((data || []).map((r) => [r.id, r]));
    const base = pendingRef.current || photosRef.current;
    const merged = sortNewestFirst([
      ...base.filter((p) => !incoming.has(p.id)),
      ...incoming.values(),
    ]);
    applyReorder(merged);
  }, [scope, applyReorder]);

  const queueNewRow = useCallback((id) => {
    newIdsRef.current.add(id);
    if (newTimerRef.current) clearTimeout(newTimerRef.current);
    newTimerRef.current = setTimeout(fetchNewRows, DEBOUNCE_MS);
  }, [fetchNewRows]);

  const onChange = useCallback((payload) => {
    if (payload.eventType === 'DELETE') {
      const id = payload.old?.id;
      if (id) removeIds(new Set([id]));
      return;
    }
    const row = payload.new;
    if (!row?.id) return;
    if (scope === 'public' && !inPublicScope(row)) { removeIds(new Set([row.id])); return; }

    const current = pendingRef.current || photosRef.current;
    const existing = current.find((p) => p.id === row.id)
      || photosRef.current.find((p) => p.id === row.id);
    // New to this list, or its sub-event tag changed (needs the join again).
    if (!existing || existing.sub_event_id !== row.sub_event_id) { queueNewRow(row.id); return; }

    const merged = { ...existing, ...row, raider_sub_events: existing.raider_sub_events };
    if (capturedAt(merged) !== capturedAt(existing)) {
      applyReorder(sortNewestFirst(current.map((p) => (p.id === row.id ? merged : p))));
      return;
    }
    applyInPlace((list) => (list.some((p) => p.id === row.id)
      ? list.map((p) => (p.id === row.id ? { ...p, ...row, raider_sub_events: p.raider_sub_events } : p))
      : list));
  }, [scope, removeIds, queueNewRow, applyReorder, applyInPlace]);

  const showNew = useCallback(() => {
    if (pendingRef.current) commit(pendingRef.current);
  }, [commit]);

  useEffect(() => {
    aliveRef.current = true;
    if (!active) {
      setPhotos([]); photosRef.current = []; pendingRef.current = null; setPendingCount(0); setLoading(false);
      return () => { aliveRef.current = false; };
    }

    setLoading(true);
    load();

    let everSubscribed = false;
    const channel = SB.channel(`optic-photos-${scope}-${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'photos', filter: `event_id=eq.${eventId}` },
        onChange,
      )
      .subscribe((status) => {
        // A re-subscribe after a drop may have missed events — reconcile.
        if (status === 'SUBSCRIBED') {
          if (everSubscribed) checkForChanges();
          everSubscribed = true;
        }
      });

    const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';
    const pollId = setInterval(() => { if (visible()) checkForChanges(); }, CHECK_POLL_MS);
    const onVisibility = () => { if (visible()) checkForChanges(); };
    document.addEventListener('visibilitychange', onVisibility);

    // If the reader scrolls back to the top themselves (rather than tapping
    // the "N new" pill), apply whatever landed while they were reading
    // instead of making them wait.
    let onScroll;
    if (deferMidScroll) {
      onScroll = () => { if (pendingRef.current && isAtTop()) showNew(); };
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    return () => {
      aliveRef.current = false;
      if (newTimerRef.current) clearTimeout(newTimerRef.current);
      newIdsRef.current = new Set();
      clearInterval(pollId);
      document.removeEventListener('visibilitychange', onVisibility);
      if (onScroll) window.removeEventListener('scroll', onScroll);
      SB.removeChannel(channel);
    };
  }, [eventId, scope, active, load, onChange, checkForChanges, deferMidScroll, showNew]);

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
