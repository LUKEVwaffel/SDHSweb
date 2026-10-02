import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase as SB } from '../../lib/supabaseClient';

// Thin data layer for /boards + the DISPATCH Boards panel. Every write goes
// through an rpc or edge function (company_boards.sql) — tables are
// SELECT-only from the browser.

/** Pull the real { error } body out of a non-2xx edge function response. */
async function fnError(data, error) {
  if (data?.error) return { message: data.error, body: data };
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    if (body?.error) return { message: body.error, body };
  }
  return { message: error?.message || 'Something went wrong', body: null };
}

async function callFn(name, body) {
  const { data, error } = await SB.functions.invoke(name, { body });
  if (error || data?.error) {
    const e = await fnError(data, error);
    const err = new Error(e.message);
    err.body = e.body;
    throw err;
  }
  return data;
}

/** Postgres raise messages arrive as "board: …" — strip the prefix for the UI. */
function rpcError(error) {
  return new Error(String(error?.message || 'Request failed').replace(/^board:\s*/, ''));
}

async function rpc(name, args) {
  const { data, error } = await SB.rpc(name, args);
  if (error) throw rpcError(error);
  return data;
}

async function select(query) {
  const { data, error } = await query;
  if (error) throw rpcError(error);
  return data ?? [];
}

/** Friendly copy for PIN failures (login + signing share the lockout). */
export function pinErrorText(err) {
  const b = err?.body;
  if (b?.error === 'locked') {
    const until = b.until ? new Date(b.until).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'later';
    return `Too many wrong PINs. Locked until ${until}.`;
  }
  if (b?.error === 'invalid') {
    return Number.isInteger(b.remaining) ? `Wrong PIN — ${b.remaining} ${b.remaining === 1 ? 'try' : 'tries'} left.` : 'Wrong email or PIN.';
  }
  return err?.message || 'Something went wrong';
}

export const boardApi = {
  async signIn(email, pin) {
    const data = await callFn('board-pin-login', { email: email.trim().toLowerCase(), pin });
    const { error } = await SB.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
    if (error) throw new Error('Sign-in failed');
  },
  signOut: () => SB.auth.signOut(),
  session: async () => (await SB.auth.getSession()).data.session,

  whoami: async () => (await rpc('board_whoami')) ?? [],
  roster: (company) => rpc('board_roster', { p_company: company }),
  setRank: (cadetId, rank) => rpc('board_set_rank', { p_cadet_id: cadetId, p_rank: rank }),
  currentSession: () => rpc('board_current_session'),
  saveSheet: (sheet) => rpc('board_save_sheet', { p: sheet }),
  discardSheet: (id) => rpc('board_discard_sheet', { p_id: id }),
  saiReview: (id, decision, promoteTo, note) =>
    rpc('board_sai_review', { p_id: id, p_decision: decision, p_promote_to: promoteTo, p_note: note }),
  openQuarter: (label) => rpc('board_open_quarter', { p_label: label }),
  closeQuarter: (id) => rpc('board_close_quarter', { p_id: id }),
  memberStatus: () => rpc('board_member_status'),

  quarters: () => select(SB.from('board_quarters').select('*').order('opened_at', { ascending: false })),
  sessions: (quarterId, company) => {
    let q = SB.from('board_sessions').select('*').eq('quarter_id', quarterId).order('opened_at');
    if (company) q = q.eq('company', company);
    return select(q);
  },
  sheets: (quarterId, company) => {
    let q = SB.from('board_sheets').select('*').eq('quarter_id', quarterId);
    if (company) q = q.eq('company', company);
    return select(q);
  },
  results: (quarterId) => {
    let q = SB.from('board_results').select('*').order('company').order('cadet_name');
    if (quarterId) q = q.eq('quarter_id', quarterId);
    return select(q);
  },
  signoffs: (quarterId) => select(SB.from('board_sai_signoffs').select('*').eq('quarter_id', quarterId)),
  members: () => select(SB.from('board_members').select('*').eq('active', true)),
  // S-6 only (cadet_consent is admin-RLS): seat picker needs school emails.
  cadetsWithEmail: (company) => select(SB.from('cadet_consent').select('id, name, school_email').eq('company', company).order('name')),

  signSession: (sessionId, seat, pin) => callFn('board-sign-session', { session_id: sessionId, seat, pin }),
  saiSignoff: (quarterId, company, pin, note) => callFn('board-sai-signoff', { quarter_id: quarterId, company, pin, note }),
  setOwnPin: (currentPin, newPin) => callFn('board-set-pin', { current_pin: currentPin, new_pin: newPin }),
  adminMember: (body) => callFn('board-admin-member', body),
};

// Sandbox: /boards/sandbox?as=<role> swaps in the fake-data API (live site
// too — it never touches Supabase). /boards?demo=<role> does the same in dev.
export const isSandbox = window.location.pathname.startsWith('/boards/sandbox');
let ready = Promise.resolve();
const params = new URLSearchParams(window.location.search);
const devDemo = import.meta.env.DEV && window.location.pathname.startsWith('/boards') ? params.get('demo') : null;
if (isSandbox || devDemo) {
  ready = import('./boardApi.demo.js').then(({ createDemoApi }) => {
    Object.assign(boardApi, createDemoApi(isSandbox ? params.get('as') || 'alpha' : devDemo));
  });
}
/** Resolves once boardApi is final (instant outside sandbox/demo). */
export const boardApiReady = ready;
