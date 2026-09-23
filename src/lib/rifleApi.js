import { supabase as SB } from './supabaseClient';
import { invokeError } from './supabaseFnError';

// Public, pre-auth wrapper around the rifle team interest signup edge
// function. See supabase/rifle_signup.sql for why the payload is this thin.
// `payload.signup_token` must be the token minted by lookupRifleCadet —
// the edge function rejects submits without a valid, matching token.
export async function submitRifleSignup(payload) {
  const { data, error } = await SB.functions.invoke('rifle-submit-signup', { body: payload });
  if (error || data?.error) return { error: await invokeError(data, error, 'Submit failed.') };
  return { data };
}

// Step 1 — verify the cadet's school email against DISPATCH's roster before
// the rest of the form unlocks (see rifle-lookup-cadet). Prevents made-up
// school emails from getting a signup in at all, same pattern as
// ball-lookup-cadet. Returns a short-lived signupToken that
// rifle-submit-signup requires as proof the email was actually verified.
export async function lookupRifleCadet(username) {
  const { data, error } = await SB.functions.invoke('rifle-lookup-cadet', { body: { username } });
  if (error || data?.error) return { error: await invokeError(data, error, 'Not found.') };
  return { data };
}
