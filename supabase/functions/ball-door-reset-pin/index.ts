import { json, preflight } from '../_shared/http.ts';
import { getCaller, serviceClient } from '../_shared/supabase.ts';
import { hashPin, PIN_RE, verifyPin } from '../_shared/pin.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== 's6' || caller.mustChangePassword) return json({ error: 'S-6 required' }, 403);
    const { approver, pin } = await req.json();
    if (!['aubry','kylie'].includes(approver) || typeof pin !== 'string' || !PIN_RE.test(pin)) return json({ error: 'Choose Aubry or Kylie and enter exactly four digits' }, 400);
    const svc = serviceClient();
    const { data: account, error: lookup } = await svc.from('ball_door_approvers').select('email').eq('key', approver).maybeSingle();
    if (lookup || !account) return json({ error: 'Reviewer is not configured' }, 404);
    const { data: others, error: otherError } = await svc.from('ball_door_approvers').select('email').neq('key', approver);
    if (otherError) return json({ error: 'Could not verify code uniqueness' }, 500);
    if (others?.length) {
      const { data: credentials, error: credentialError } = await svc.from('ball_dress_staff').select('pin_hash').in('email', others.map(person => person.email));
      if (credentialError) return json({ error: 'Could not verify code uniqueness' }, 500);
      for (const credential of credentials || []) {
        if (await verifyPin(pin, credential.pin_hash)) return json({ error: 'Aubry and Kylie must have different codes so the reviewer can be identified automatically' }, 409);
      }
    }
    const { data, error } = await svc.from('ball_dress_staff').update({ pin_hash: await hashPin(pin), pin_fail_count: 0, pin_locked_until: null, updated_at: new Date().toISOString() }).eq('email', account.email).select('email').single();
    if (error || !data) return json({ error: 'Passcode was not reset' }, 500);
    return json({ ok: true, approver });
  } catch {
    // Do not log passcodes or request bodies.
    return json({ error: 'Could not reset the passcode' }, 500);
  }
});
