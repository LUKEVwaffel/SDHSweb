import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase as sb } from '../../../lib/supabaseClient';
export async function invoke(name, body) {
  const { data, error } = await sb.functions.invoke(name, { body, timeout: 20000 });
  if (error || data?.error) {
    let detail = data;
    if (error instanceof FunctionsHttpError) detail = await error.context.json().catch(() => null);
    const err = new Error(detail?.error || error?.message || 'Request failed');
    err.body = detail; throw err;
  }
  return data;
}
async function rpc(name, args, signal = AbortSignal.timeout(12000)) {
  const { data, error } = await sb.rpc(name, args).abortSignal(signal);
  if (error) throw new Error(signal?.aborted ? 'The request timed out. Check the connection and current session before retrying.' : error.message.replace(/^board:\s*/, ''));
  return data;
}
export const identityApi = {
  whoami: () => rpc('board_whoami'),
  directory: () => rpc('board_leader_directory'),
  verify: (member_id, dob) => invoke('board-onboarding', { action: 'verify_dob', member_id, dob }),
  async finish(body) {
    const result = await invoke('board-onboarding', body);
    const { error } = await sb.auth.verifyOtp({ token_hash: result.token_hash, type: 'magiclink' });
    if (error) throw new Error('Sign-in could not finish. Return to your name and sign in with your PIN.');
  },
};
export const meetingApi = {
  load: (signal) => rpc('board_practice_state', undefined, signal),
  openCadet: (sessionId, cadetId, focus) => rpc('board_practice_open_cadet', { p_session_id: sessionId, p_cadet_id: cadetId, p_expected_focus: focus }),
  patchField: (sessionId, cadetId, focus, field, value, expected) => rpc('board_practice_patch_field', { p_session_id: sessionId, p_cadet_id: cadetId, p_focus: focus, p_field: field, p_value: value, p_expected_value: expected }).then((data) => { const row = Array.isArray(data) ? data[0] : data; if (!row?.id) throw new Error('The shared change could not be confirmed. Refresh the board.'); return row; }),
  finishCadet: (sessionId, cadetId, focus, revision) => rpc('board_practice_finish_cadet', { p_session_id: sessionId, p_cadet_id: cadetId, p_focus: focus, p_expected_revision: revision }),
  pauseCadet: (sessionId, cadetId, focus) => rpc('board_practice_pause_cadet', { p_session_id: sessionId, p_cadet_id: cadetId, p_focus: focus }),
  heartbeat: () => rpc('board_practice_heartbeat'),
  start: (title, company = null) => rpc('board_practice_start', { p_title: title, p_company: company }),
  end: (roundId, sessionId = null) => rpc('board_practice_end', { p_round_id: roundId, p_session_id: sessionId }),
  unlock: (memberId) => rpc('board_practice_unlock_member', { p_member_id: memberId }),
  cancel: (roundId, reason) => rpc('board_practice_cancel', { p_round_id: roundId, p_reason: reason }),
  save: (sheet) => rpc('board_practice_save', { p: sheet }),
  discard: (id, revision) => rpc('board_practice_discard', { p_id: id, p_revision: revision }),
  sign: (sessionId, pin) => invoke('board-practice-sign', { session_id: sessionId, pin }),
};
