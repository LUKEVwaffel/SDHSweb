import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

const PAGE_SIZE = 30;
// Embeds the event join so every consumer's photos carry event name/date for
// the lightbox — mirrors photoQueries.js's PHOTO_SELECT (kept local here to
// avoid a hook -> lib -> hook import cycle risk as this file grows).
const PHOTO_SELECT = '*, events(title,date,team)';

// Keyset pagination on created_at — NOT offset/range, because photos is a
// live-inserting table (DISPATCH bulk upload, public submissions). Offset
// pagination would skip or duplicate rows when new photos land between page
// fetches; keyset (created_at < cursor) is stable regardless of new inserts.
//
// visibility='staged' rows (the Rhea comp's unpublished Luke dump) are filtered
// out CLIENT-SIDE, not in the query — so this hook keeps working whether or not
// the rhea_comp_photos migration has added the column yet. Pagination math uses
// the raw page so a rare all-staged page can't stall it.
const isPublicRow = (p) => p.visibility !== 'staged';

export function usePaginatedPhotos({ team = null, eventId = null } = {}) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef(null);

  const buildQuery = useCallback((cursor) => {
    let q = SB.from('photos').select(PHOTO_SELECT).eq('status', 'live');
    if (team) q = q.eq('team', team);
    if (eventId) q = q.eq('event_id', eventId);
    if (cursor) q = q.lt('created_at', cursor);
    return q.order('created_at', { ascending: false }).limit(PAGE_SIZE);
  }, [team, eventId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setPhotos([]);
    cursorRef.current = null;
    setHasMore(true);
    buildQuery(null).then(({ data, error }) => {
      if (!alive) return;
      const rows = error ? [] : (data || []);
      setPhotos(rows.filter(isPublicRow));
      cursorRef.current = rows.length ? rows[rows.length - 1].created_at : null;
      setHasMore(rows.length === PAGE_SIZE);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [buildQuery]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursorRef.current) return;
    setLoadingMore(true);
    const { data, error } = await buildQuery(cursorRef.current);
    const rows = error ? [] : (data || []);
    setPhotos((prev) => [...prev, ...rows.filter(isPublicRow)]);
    cursorRef.current = rows.length ? rows[rows.length - 1].created_at : cursorRef.current;
    setHasMore(rows.length === PAGE_SIZE);
    setLoadingMore(false);
  }, [buildQuery, loadingMore, hasMore]);

  return { photos, loading, loadingMore, hasMore, loadMore };
}

// Attaches to a sentinel element near the bottom of a photo grid — fires
// loadMore ~200px before it scrolls into view. Kept separate from the manual
// "LOAD MORE" button consumers render alongside it (fallback for a11y and for
// anyone with IntersectionObserver-hostile setups).
export function useInfiniteScrollSentinel(loadMore, { hasMore, disabled = false } = {}) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (disabled || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, hasMore, disabled]);

  return sentinelRef;
}
