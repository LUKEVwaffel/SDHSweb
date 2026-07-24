import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { supabase as SB } from './supabaseClient';

// Client half of the WebAuthn (Touch ID) flow. The server (@simplewebauthn/server
// v9 in the edge functions) MUST stay on a matching major version — the options
// JSON shape is version-coupled.

// Register a passkey for the CURRENTLY SIGNED-IN account (self only, enforced
// server-side by passkey-register from the JWT). Returns { ok } or throws.
export async function registerPasskey(label) {
  const start = await SB.functions.invoke('passkey-register', { body: { action: 'start' } });
  if (start.error || start.data?.error) throw new Error(start.data?.error || start.error.message);

  // Browser prompts Touch ID / platform authenticator here.
  const response = await startRegistration(start.data.options);

  const finish = await SB.functions.invoke('passkey-register', { body: { action: 'finish', response, label } });
  if (finish.error || finish.data?.error) throw new Error(finish.data?.error || finish.error.message);
  return { ok: true };
}

// Log in with a passkey for `email`. On success, exchanges the returned
// magic-link token for a real Supabase session (verifyOtp), which trips the
// onAuthStateChange listener in admin/index.jsx. Returns { ok } or throws.
export async function loginWithPasskey(email) {
  const start = await SB.functions.invoke('passkey-login', { body: { action: 'start', email } });
  if (start.error || start.data?.error) throw new Error(start.data?.error || start.error.message);

  const response = await startAuthentication(start.data.options);

  const finish = await SB.functions.invoke('passkey-login', { body: { action: 'finish', email, response } });
  if (finish.error || finish.data?.error) throw new Error(finish.data?.error || finish.error.message);

  const { error } = await SB.auth.verifyOtp({ token_hash: finish.data.token_hash, type: 'magiclink' });
  if (error) throw new Error(error.message);
  return { ok: true };
}
