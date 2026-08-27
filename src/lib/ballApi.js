import { supabase as SB } from './supabaseClient';

// Thin wrappers around the public Ball signup edge functions. All of these
// run pre-auth (no Supabase session) — identity is proven by the signed
// signupToken minted in lookupCadet, not by anything client-side.

export async function lookupCadet(username) {
  const { data, error } = await SB.functions.invoke('ball-lookup-cadet', { body: { username } });
  if (error || data?.error) return { error: data?.error || error?.message || 'Not found.' };
  return { data };
}

export async function searchRoster(signupToken, q) {
  const { data, error } = await SB.functions.invoke('ball-search-roster', { body: { signupToken, q } });
  if (error || data?.error) return { error: data?.error || error?.message || 'Search failed.' };
  return { data: data.results || [] };
}

export async function resolveRosterCadet(signupToken, cadetId) {
  const { data, error } = await SB.functions.invoke('ball-search-roster', { body: { signupToken, cadet_id: cadetId } });
  if (error || data?.error) return { error: data?.error || error?.message || 'Lookup failed.' };
  return { data };
}

export async function submitSignup(signupToken, payload) {
  const { data, error } = await SB.functions.invoke('ball-submit-signup', { body: { signupToken, ...payload } });
  if (error || data?.error) return { error: data?.error || error?.message || 'Submit failed.' };
  return { data };
}

export async function guestVerify(token, { allergies, accepted_dress_code }) {
  const { data, error } = await SB.functions.invoke('ball-guest-verify', {
    body: { token, allergies, accepted_dress_code },
  });
  if (error || data?.error) return { error: data?.error || error?.message || 'Verification failed.' };
  return { data };
}
