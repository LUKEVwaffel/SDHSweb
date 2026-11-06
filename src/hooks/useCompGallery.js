import { useState, useEffect } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

// Page every record: a season exceeds PostgREST's 1,000-row response cap.
export async function fetchRaiderArchive(client = SB) {
  const photos = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await client.from('photos')
      .select('id,event_id,photo_url,thumb_url,grid_url,uploader_name,sub_event_id,raider_team,created_at,taken_at,raider_sub_events(name,team)')
      .eq('team', 'raiders').eq('status', 'live')
      // Preserve Luke's existing archive scope; parent photos must be published.
      .or('source.eq.luke,visibility.eq.public')
      .order('id').range(start, start + 999);
    if (error) throw error;
    photos.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const { data: events, error } = await client.from('events').select('id,title,date').eq('team', 'raiders');
  if (error) throw error;
  photos.sort((a, b) => new Date(a.taken_at || a.created_at) - new Date(b.taken_at || b.created_at) || a.id.localeCompare(b.id));
  const competitions = [...new Set(photos.map((p) => p.event_id))].map((id) => {
    const event = events.find((e) => e.id === id);
    return { id: id || 'general', title: event?.title || 'Other Raider photos', date: event?.date || '', photos: photos.filter((p) => p.event_id === id) };
  }).sort((a, b) => b.date.localeCompare(a.date));
  return { photos, competitions };
}

export function useCompGallery() {
  const [state, setState] = useState({ photos: [], competitions: [], loading: true, error: null });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchRaiderArchive().then((data) => {
      if (!cancelled) setState({ ...data, loading: false, error: null });
    }).catch((error) => {
      if (!cancelled) setState({ photos: [], competitions: [], loading: false, error: error.message || 'Unable to load photos.' });
    });
    return () => { cancelled = true; };
  }, [retry]);
  return { ...state, refresh: () => setRetry((n) => n + 1) };
}
