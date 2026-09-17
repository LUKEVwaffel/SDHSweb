import { supabase as SB } from './supabaseClient';
import { invokeError } from './supabaseFnError';

export async function rifleSetPin(email, pin) {
  const { data, error } = await SB.functions.invoke('rifle-set-pin', { body: { email, pin } });
  if (error || data?.error) return { error: await invokeError(data, error, 'Could not set PIN') };
  return { ok: true };
}

export async function rifleClearPin(email) {
  const { data, error } = await SB.functions.invoke('rifle-clear-pin', { body: { email } });
  if (error || data?.error) return { error: await invokeError(data, error, 'Could not clear PIN') };
  return { ok: true };
}

export async function rifleCompleteFirstLogin() {
  const { data, error } = await SB.functions.invoke('complete-rifle-first-login', { body: {} });
  if (error || data?.error) return { error: await invokeError(data, error, 'Could not finish setup') };
  return { ok: true };
}
