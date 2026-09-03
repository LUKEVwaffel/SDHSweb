import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase as SB } from './supabaseClient';

// Thin wrappers around the public Ball signup edge functions. All of these
// run pre-auth (no Supabase session) — identity is proven by the signed
// signupToken minted in lookupCadet, not by anything client-side.

// supabase-js's functions.invoke() does NOT surface the edge function's JSON
// error body on a non-2xx response: `data` is null and `error` is a
// FunctionsHttpError whose .message is the fixed string "Edge Function
// returned a non-2xx status code". The real { error: "..." } is on
// error.context (an unread Response) — read it here so callers get the actual
// reason instead of that opaque line.
async function invokeError(data, error, fallback) {
  if (data?.error) return data.error;
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    if (body?.error) return body.error;
  }
  return error?.message || fallback;
}

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

export async function guestVerify(token, { allergies, accepted_dress_code, phone }) {
  const { data, error } = await SB.functions.invoke('ball-guest-verify', {
    body: { token, allergies, accepted_dress_code, phone },
  });
  if (error || data?.error) return { error: await invokeError(data, error, 'Verification failed.') };
  return { data };
}
