// Pre-auth name/DOB enrollment and subsequent PIN login. Never return a DOB
// or school email to the name picker; setup proofs are short-lived and single-use.
import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { hashPin, PIN_RE } from '../_shared/pin.ts';
import { checkBoardPin } from '../_shared/board.ts';
import { mintSessionToken } from '../_shared/session.ts';

async function sessionFor(email: string) {
  const { error } = await serviceClient().auth.admin.createUser({ email, email_confirm: true });
  if (error && !/already|registered|exists/i.test(error.message)) throw new Error('Could not prepare sign-in account');
  return await mintSessionToken(email);
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const svc = serviceClient();
    if (body.action === 'verify_dob') {
      if (!/^[0-9a-f-]{36}$/i.test(String(body.member_id)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.dob))) return json({ error: 'Check your name and date of birth.' }, 400);
      const { data, error } = await svc.rpc('board_verify_enrollment', { p_member_id: body.member_id, p_dob: body.dob });
      if (error) return json({ error: 'Unable to verify these details. Check your date of birth.' }, 400);
      if (data?.error) return json({ error: data.error }, 401);
      return json(data);
    }
    if (body.action === 'set_pin') {
      if (!PIN_RE.test(String(body.pin ?? '')) || !/^[a-f0-9]{64}$/.test(String(body.setup_token ?? ''))) return json({ error: 'Verify your date of birth and choose a four-digit PIN.' }, 400);
      const { data: email, error } = await svc.rpc('board_finish_enrollment', { p_token: body.setup_token, p_pin_hash: await hashPin(String(body.pin)) });
      if (error || !email) return json({ error: error?.message.startsWith('board: ') ? error.message.slice(7) : 'Setup expired. Verify your date of birth again.', next_step: error?.message.includes('PIN already set') ? 'pin' : 'verify_dob' }, 409);
      return json({ ok: true, token_hash: await sessionFor(email) });
    }
    if (body.action === 'pin_login') {
      if (!PIN_RE.test(String(body.pin ?? ''))) return json({ error: 'invalid' }, 401);
      const { data: member } = await svc.from('board_members').select('email').eq('public_id', body.member_id).eq('active', true).maybeSingle();
      if (!member) return json({ error: 'invalid' }, 401);
      const check = await checkBoardPin(member.email, String(body.pin));
      if (!check.ok) return json(check.body, check.status);
      return json({ ok: true, token_hash: await sessionFor(member.email) });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch {
    // Request bodies contain DOBs/PINs. Never log them or upstream auth errors.
    return json({ error: 'Sign-in could not finish. If your PIN was saved, return to your name and use that PIN.' }, 500);
  }
});
