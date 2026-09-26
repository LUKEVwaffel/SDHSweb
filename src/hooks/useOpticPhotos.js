import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase as SB } from '../lib/supabaseClient';
import { chunkIds } from '../lib/opticComp';

const SELECT = '*, raider_sub_events(name, team)';
const CHECK_POLL_MS = 120_000; // lightweight safety net, see checkForChanges()
const DEBOUNCE_MS = 350;
const TOP_THRESHOLD_PX = 48;

const capturedAt = (p) => new Date(p.taken_at || p.created_at).getTime();
const sortNewestFirst = (rows) => rows.slice().sort((a, b) => capturedAt(b) - capturedAt(a));
const isAtTop = () => typeof window === 'undefined' || window.scrollY <= TOP_THRESHOLD_PX;
const inPublicScope = (row) => row.visibility === 'public' && row.status === 'live';
const uniq = () => Math.random().toString(36).slice(2, 10);

// PostgREST caps a single select at 1000 rows (Supabase default max-rows) and
// silently truncates past it — with no ORDER BY that drops an arbitrary slice,
// newest photos included. A full comp (Luke's card + parents) can pass that,
// so full-list reads page through with a stable order. One request, same as
// before, until a list actually crosses 1000.
const PAGE = 1000;
async function selectAllPages(build) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await build().order('id').range(from, from + PAGE - 1);
    if (error) return { data: null, error };
    out.push(...(data || []));
    if (!data || data.length < PAGE) return { data: out, error: null };
  }
}

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
 * @param {object[]|null} [opts.initialPhotos]  rows to paint immediately
 *        (e.g. /lukepwa's on-device cache from last session) while the real
 *        list loads. Only honoured on first mount, and dropped the moment
 *        they turn out to belong to a different event.
 */
export function useOpticPhotos({
  eventId, scope = 'public', enabled = true, deferMidScroll = false, initialPhotos = null,
} = {}) {
  const [photos, setPhotos] = useState(() => initialPhotos || []);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(() => !initialPhotos?.length);
  const [error, setError] = useState(null);
  const aliveRef = useRef(true);
  const photosRef = useRef(initialPhotos || []);
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
    const { data, error: qErr } = await selectAllPages(() => {
      const q = SB.from('photos').select(SELECT).eq('event_id', eventId);
      return scope === 'public' ? q.eq('visibility', 'public').eq('status', 'live') : q;
    });
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
  //
  // Plus blurred photos, in full. A blur swaps a photo's files but keeps its
  // id, so an id/like check can't see it, and a phone that was locked when
  // the realtime UPDATE went out would keep showing the sharp face until a
  // full reload. Blurred rows are few and marked by `_blur` in storage_path
  // (both the /lukepwa editor and the DISPATCH one), so they're re-read
  // whole on every check and patched in place.
  const checkForChanges = useCallback(async () => {
    const scoped = (q) => (scope === 'public' ? q.eq('visibility', 'public').eq('status', 'live') : q);
    const [{ data, error: qErr }, blurred] = await Promise.all([
      selectAllPages(() => scoped(SB.from('photos').select('id, like_count').eq('event_id', eventId))),
      scoped(SB.from('photos').select('*').eq('event_id', eventId).like('storage_path', '%_blur%')),
    ]);
    if (!aliveRef.current) return;
    if (!blurred.error && blurred.data?.length) {
      const fresh = new Map(blurred.data.map((r) => [r.id, r]));
      applyInPlace((list) => (list.some((p) => fresh.has(p.id) && fresh.get(p.id).photo_url !== p.photo_url)
        ? list.map((p) => (fresh.has(p.id) && fresh.get(p.id).photo_url !== p.photo_url
          ? { ...p, ...fresh.get(p.id), raider_sub_events: p.raider_sub_events }
          : p))
        : list));
    }
    if (qErr || !data) return;
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
    // Chunked: a big publish burst can queue hundreds of ids, too many for
    // one URL. A failed chunk is left for checkForChanges to reconcile.
    const results = await Promise.all(chunkIds(ids).map((part) => {
      const q = SB.from('photos').select(SELECT).in('id', part);
      return scope === 'public' ? q.eq('visibility', 'public').eq('status', 'live') : q;
    }));
    if (!aliveRef.current) return;
    const ok = results.filter((r) => !r.error);
    if (!ok.length) return;
    const incoming = new Map(ok.flatMap((r) => r.data || []).map((r) => [r.id, r]));
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

    // Seeded rows from another event (the comp was switched since the cache
    // was written) must never show under this one.
    if (photosRef.current.length && photosRef.current[0].event_id !== eventId) commit([]);
    // Already painting seeded rows: refresh underneath them, no skeleton.
    if (!photosRef.current.length) setLoading(true);
    load();

    let everSubscribed = false;
    // Unique per mount (see useOpticConfig): a same-name remount before the
    // old channel's leave is acked — the gate flipping LOCK -> OPEN, a quick
    // back-navigation — gets that dying channel back, and its subscribe() is
    // a no-op, so the feed would silently stop updating.
    const channel = SB.channel(`optic-photos-${scope}-${eventId}-${uniq()}`)
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
  }, [eventId, scope, active, load, onChange, checkForChanges, deferMidScroll, showNew, commit]);

  return { photos, loading, error, pendingCount, showNew, refresh: load };
}

/**
 * Live sub-event list for the comp (realtime on raider_sub_events). Powers the
 * quick-select tagging list in /lukepwa.
 */
export function useOpticSubEvents({ eventId, enabled = true, initialSubEvents = null } = {}) {
  const [subEvents, setSubEvents] = useState(() => initialSubEvents || []);
  const [loading, setLoading] = useState(() => !initialSubEvents);
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
    const channel = SB.channel(`optic-sub-events-${eventId}-${uniq()}`)
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
