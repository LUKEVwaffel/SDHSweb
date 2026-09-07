import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

// Public read model for the rafting trip photo set. One fetch on mount -
// a flat, retrospective gallery, no live-event pressure and no sub-events.
// Rows come from public.rafting_photos (see supabase/rafting_photos.sql),
// written from DISPATCH -> Rafting Trip.
export function useRaftingPhotos() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    const { data, error: err } = await SB.from('rafting_photos')
      .select('id, url, caption, sort_order, created_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (!alive.current) return;
    setError(err ? (err.message || String(err)) : null);
    setPhotos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; };
  }, [load]);

  return { photos, loading, error, refresh: load };
}
