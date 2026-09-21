import { supabase as SB } from './supabaseClient';

// Central error-code registry for the Ball approval portals (dress, attire,
// ops/payments). Every failure a reviewer can hit gets a stable code so they
// can read it off screen and report it — Luke greps app_error_log for the
// code instead of working from "it didn't work". See supabase/app_error_log.sql.
export const ERROR_CODES = {
  // Ball Ops (payments) — /ball/ops
  BALL_OPS_SESSION_TIMEOUT: 'BALL-OPS-001',
  BALL_OPS_SESSION_ERROR: 'BALL-OPS-002',
  BALL_OPS_NOT_AUTHORIZED: 'BALL-OPS-003',
  BALL_OPS_LOAD_FAILED: 'BALL-OPS-010',
  BALL_OPS_TOGGLE_FAILED: 'BALL-OPS-020',
  BALL_OPS_TOGGLE_EXCEPTION: 'BALL-OPS-021',

  // Dress Approval — /ball/dress
  BALL_DRESS_SESSION_TIMEOUT: 'BALL-DRESS-001',
  BALL_DRESS_NOT_AUTHORIZED: 'BALL-DRESS-003',
  BALL_DRESS_LOAD_FAILED: 'BALL-DRESS-010',
  BALL_DRESS_TOGGLE_FAILED: 'BALL-DRESS-020',
  BALL_DRESS_TOGGLE_EXCEPTION: 'BALL-DRESS-021',
  BALL_DRESS_BULK_FAILED: 'BALL-DRESS-030',
  BALL_DRESS_BULK_EXCEPTION: 'BALL-DRESS-031',

  // Male-Guest Attire — /ball/attire
  BALL_ATTIRE_NOT_AUTHORIZED: 'BALL-ATTIRE-003',
  BALL_ATTIRE_LOAD_FAILED: 'BALL-ATTIRE-010',
  BALL_ATTIRE_TOGGLE_FAILED: 'BALL-ATTIRE-020',
  BALL_ATTIRE_TOGGLE_EXCEPTION: 'BALL-ATTIRE-021',
  BALL_ATTIRE_BULK_FAILED: 'BALL-ATTIRE-030',
  BALL_ATTIRE_BULK_EXCEPTION: 'BALL-ATTIRE-031',
};

// Fire-and-forget — logging must never itself break the UI flow a reviewer
// is already stuck in, so failures here are swallowed. Returns the
// user-facing string (code included) for the caller to show inline.
export function reportError(code, portal, message, { detail, context } = {}) {
  SB.rpc('log_client_error', {
    p_code: code,
    p_portal: portal,
    p_message: message,
    p_detail: detail ?? null,
    p_context: context ?? null,
  }).catch(() => {});
  return `${message} (Error ${code} — write this down so it can be looked up)`;
}
