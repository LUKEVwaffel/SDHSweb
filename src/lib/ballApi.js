import { supabase as SB } from './supabaseClient';
import { invokeError } from './supabaseFnError';

// Thin wrappers around the public Ball signup edge functions. All of these
// run pre-auth (no Supabase session) — identity is proven by the signed
// signupToken minted in lookupCadet, not by anything client-side.

export async function lookupCadet(username) {
  const { data, error } = await SB.functions.invoke('ball-lookup-cadet', { body: { username } });
  if (error || data?.error) return { error: await invokeError(data, error, 'Not found.') };
  return { data };
}

export async function searchRoster(signupToken, q) {
  const { data, error } = await SB.functions.invoke('ball-search-roster', { body: { signupToken, q } });
  if (error || data?.error) return { error: await invokeError(data, error, 'Search failed.') };
  return { data: data.results || [] };
}

export async function resolveRosterCadet(signupToken, cadetId) {
  const { data, error } = await SB.functions.invoke('ball-search-roster', { body: { signupToken, cadet_id: cadetId } });
  if (error || data?.error) return { error: await invokeError(data, error, 'Lookup failed.') };
  return { data };
}

export async function submitSignup(signupToken, payload) {
  const { data, error } = await SB.functions.invoke('ball-submit-signup', { body: { signupToken, ...payload } });
  if (error || data?.error) return { error: await invokeError(data, error, 'Submit failed.') };
  return { data };
}

// VIP path (visiting XO/BC, past King/Queen) — no signupToken, no roster
// lookup. See ball_vip_signup.sql for why this bypasses the whole cadet flow.
export async function submitVipSignup(payload) {
  const { data, error } = await SB.functions.invoke('ball-submit-vip-signup', { body: payload });
  if (error || data?.error) return { error: await invokeError(data, error, 'Submit failed.') };
  return { data };
}

// Read-only: guest gender + name for the verify page, so the dress code shown
// there can be scoped to this guest. Never mutates.
export async function guestPeek(token) {
  const { data, error } = await SB.functions.invoke('ball-guest-verify', { body: { token, peek: true } });
  if (error || data?.error) return { error: await invokeError(data, error, 'Lookup failed.') };
  return { data };
}

export async function guestVerify(token, { allergies, accepted_dress_code, phone }) {
  const { data, error } = await SB.functions.invoke('ball-guest-verify', {
    body: { token, allergies, accepted_dress_code, phone },
  });
  if (error || data?.error) return { error: await invokeError(data, error, 'Verification failed.') };
  return { data };
}
