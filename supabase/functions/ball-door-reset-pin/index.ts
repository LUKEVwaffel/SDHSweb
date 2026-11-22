import { json, preflight } from '../_shared/http.ts';
import { getCaller, serviceClient } from '../_shared/supabase.ts';
import { hashPin, PIN_RE, verifyPin } from '../_shared/pin.ts';
import { DOOR_REVIEWER_KEYS } from '../_shared/doorReviewer.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== 's6' || caller.mustChangePassword) return json({ error: 'S-6 required' }, 403);
    const { approver, pin } = await req.json();
    if (!DOOR_REVIEWER_KEYS.includes(approver) || typeof pin !== 'string' || !PIN_RE.test(pin)) return json({ error: 'Choose a reviewer and enter exactly four digits' }, 400);
    const svc = serviceClient();
    const { data: credentials, error: lookup } = await svc.rpc('ball_door_reviewer_credentials');
    if (lookup) return json({ error: 'Could not verify code uniqueness' }, 500);
    const account = credentials?.find((reviewer: {key: string}) => reviewer.key === approver);
    if (!account) return json({ error: 'Reviewer is not configured' }, 404);
    for (const reviewer of credentials) {
      if (reviewer.key !== approver && await verifyPin(pin, reviewer.pin_hash)) {
        return json({ error: 'Reviewer passcodes must be different so the reviewer can be identified automatically' }, 409);
      }
    }
    const pinHash = await hashPin(pin);
    const reset = ['luke', 'danielle'].includes(approver)
      ? svc.from('ball_door_approvers').update({ door_pin_hash: pinHash }).eq('key', approver)
      : svc.from('ball_dress_staff').update({ pin_hash: pinHash, pin_fail_count: 0, pin_locked_until: null, updated_at: new Date().toISOString() }).eq('email', account.email);
    const { data, error } = await reset.select('email').single();
    if (error || !data) return json({ error: 'Passcode was not reset' }, 500);
    return json({ ok: true, approver });
  } catch {
    // Do not log passcodes or request bodies.
    return json({ error: 'Could not reset the passcode' }, 500);
  }
});
