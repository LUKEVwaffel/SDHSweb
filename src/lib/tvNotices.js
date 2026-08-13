import { supabase as SB } from './supabaseClient';
import { getDeviceId } from './fingerprint';

/**
 * CRUD for tv_notices (Announcements + Notes from Staff, TvRangeRotationLayout.jsx).
 * Same shape for both categories — see supabase/tv_notices.sql for why they're
 * one table. Every write is fingerprinted, same convention as
 * updateTvDailySettings() in useTvDailySettings.js. Each returns { error } so
 * callers must check it — a failed write here should never look like a
 * successful save in the admin UI.
 */
export async function createTvNotice({ screenSlug, category, title, message }) {
  const fingerprint = await getDeviceId();
  const { error } = await SB.from('tv_notices').insert({
    screen_slug: screenSlug,
    category,
    title,
    message,
    created_by_fingerprint: fingerprint,
  });
  return { error };
}

export async function updateTvNotice(id, { title, message }) {
  const { error } = await SB.from('tv_notices').update({ title, message }).eq('id', id);
  return { error };
}

export async function deleteTvNotice(id) {
  const { error } = await SB.from('tv_notices').delete().eq('id', id);
  return { error };
}
