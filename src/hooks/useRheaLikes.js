import { useState, useEffect, useRef, useCallback } from 'react';
import { getDeviceId } from '../lib/fingerprint';
import { fetchMyLikes, setLike } from '../lib/rheaComp';

/**
 * Device-scoped like state for the /rhea feed.
 *
 * The authoritative count lives on `photo.like_count` (a DB trigger keeps it
 * current and the photos realtime subscription streams the change to every
 * client). This hook only tracks which photos THIS device has liked, applies
 * optimistic updates, and nudges the displayed count until the real value
 * catches up.
 *
 * @param {Array<{id:string, like_count?:number}>} photos  current feed list
 */
export function useRheaLikes(photos) {
  const [liked, setLiked] = useState(() => new Set());   // photo ids liked here
  const [pending, setPending] = useState(() => new Map()); // id -> count nudge (+1 / -1)
  const fpRef = useRef(null);
  const likedRef = useRef(liked);
  likedRef.current = liked;

  // Resolve this device's existing likes once.
  useEffect(() => {
    let alive = true;
    getDeviceId().then(async (fp) => {
      fpRef.current = fp;
      const set = await fetchMyLikes(fp);
      if (alive) setLiked(set);
    });
    return () => { alive = false; };
  }, []);

  // When the real like_count for a photo moves, drop the matching optimistic
  // nudge so we don't double-count.
  const baseRef = useRef(new Map());
  useEffect(() => {
    setPending((prev) => {
      let next = prev;
      for (const p of photos) {
        const base = baseRef.current.get(p.id);
        if (prev.has(p.id) && base != null && p.like_count !== base) {
          if (next === prev) next = new Map(prev);
          next.delete(p.id);
        }
      }
      return next;
    });
    for (const p of photos) baseRef.current.set(p.id, p.like_count ?? 0);
  }, [photos]);

  const toggle = useCallback(async (photo) => {
    const id = photo.id;
    const fp = fpRef.current || (await getDeviceId());
    fpRef.current = fp;
    const had = likedRef.current.has(id);
    const dir = had ? -1 : 1;

    setLiked((s) => { const n = new Set(s); had ? n.delete(id) : n.add(id); return n; });
    setPending((m) => { const n = new Map(m); n.set(id, (n.get(id) || 0) + dir); return n; });

    try {
      await setLike(id, fp, !had);
    } catch {
      // roll back
      setLiked((s) => { const n = new Set(s); had ? n.add(id) : n.delete(id); return n; });
      setPending((m) => { const n = new Map(m); n.set(id, (n.get(id) || 0) - dir); return n; });
    }
  }, []);

  const isLiked = useCallback((id) => liked.has(id), [liked]);
  const countFor = useCallback(
    (photo) => Math.max(0, (photo.like_count || 0) + (pending.get(photo.id) || 0)),
    [pending],
  );

  return { isLiked, countFor, toggle };
}
