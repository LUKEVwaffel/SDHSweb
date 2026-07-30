import { supabase as SB } from './supabaseClient';

// Single source of truth for "public, moderated" photo reads. Fixes two gaps
// found in the old Pictures.jsx query: (1) it required event_id, which only
// Raiders photos ever get (PhotoUploader only asks for an event on voting
// teams), so non-Raiders submissions never showed; (2) it didn't filter
// status, so admin-hidden photos still leaked onto the public page.
export async function fetchRecentPhotos({ eventId = null, limit = 60 } = {}) {
  let query = SB.from('photos').select('*').eq('status', 'live');
  if (eventId) query = query.eq('event_id', eventId);
  query = query.order('created_at', { ascending: false }).limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
