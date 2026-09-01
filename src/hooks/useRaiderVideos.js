import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

// The durable Raider video library (public.raider_videos), ordered the way
// DISPATCH arranged it. Not live-synced — the table isn't on the Realtime
// publication — so callers that need a fresh list after a change call
// reload(). Good enough: the remote refetches on mount and the DISPATCH panel
// reloads after every edit it makes.
export function useRaiderVideos() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await SB.from('raider_videos')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    setVideos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { videos, loading, reload };
}
