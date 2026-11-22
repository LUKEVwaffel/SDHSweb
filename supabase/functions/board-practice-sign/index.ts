import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { PIN_RE } from '../_shared/pin.ts';
import { getBoardMember, checkBoardPin } from '../_shared/board.ts';
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const me = await getBoardMember(req);
    if (!me?.company || !['co','xo','1sg'].includes(me.board_role)) return json({ error: 'Company leadership sign-in required' }, 403);
    const { session_id, pin } = await req.json().catch(() => ({}));
    if (!PIN_RE.test(String(pin ?? ''))) return json({ error: 'invalid' }, 401);
    const check = await checkBoardPin(me.email, String(pin));
    if (!check.ok) return json(check.body, check.status);
    const { data, error } = await serviceClient().rpc('board_practice_commit_signature', { p_session_id: session_id, p_email: me.email });
    if (error) return json({ error: error.message.startsWith('board: ') ? error.message.slice(7) : 'Signature could not be recorded. Please retry.' }, 409);
    return json({ ok: true, signature: data });
  } catch { return json({ error: 'Signature could not be recorded. Please retry.' }, 500); }
});
