import { supabase as SB } from './supabaseClient';
import { invokeError } from './supabaseFnError';

// Public, pre-auth wrapper around the rifle team interest signup edge
// function. See supabase/rifle_signup.sql for why the payload is this thin.
export async function submitRifleSignup(payload) {
  const { data, error } = await SB.functions.invoke('rifle-submit-signup', { body: payload });
  if (error || data?.error) return { error: await invokeError(data, error, 'Submit failed.') };
  return { data };
}
