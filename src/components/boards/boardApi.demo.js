// SANDBOX stand-in for boardApi — fake data, no Supabase, no real logins.
// Live at /boards/sandbox?as=alpha|bravo|charlie|delta|sai|viewer (and
// /boards?demo=… in dev). State lives in this tab's sessionStorage, so
// boarding as a company then switching to the SAI shows the same sheets.
// Every signature PIN is 1234. Names are fictional.
import { totalScore, promotionEligibility, normalizeLet } from '../../lib/boardRules';
import { STORE_KEY } from './sandboxConfig';

const FIRST = ['Avery', 'Jordan', 'Riley', 'Casey', 'Morgan', 'Quinn', 'Rowan', 'Skyler', 'Emerson', 'Hayden', 'Reese', 'Parker', 'Logan', 'Sawyer', 'Drew', 'Blake', 'Kendall', 'Finley'];
const LAST = ['Adams', 'Brooks', 'Carter', 'Dawson', 'Ellis', 'Foster', 'Grant', 'Hughes', 'Irving', 'Jensen', 'Keller', 'Lowe', 'Mercer', 'Nolan', 'Owens', 'Pryor', 'Quarles', 'Ramsey'];
const RANKS_BY_LET = { 1: ['PVT', 'PV2', null], 2: ['PFC', 'CPL', 'SGT'], 3: ['SGT', 'SSG'], 4: ['SFC'] };
const COMPANIES = ['alpha', 'bravo', 'charlie', 'delta'];
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function makeRoster() {
  const out = [];
  COMPANIES.forEach((company, ci) => {
    for (let i = 0; i < 16; i++) {
      const let_ = i < 8 ? 1 : i < 12 ? 2 : i < 15 ? 3 : 4;
      const ranks = RANKS_BY_LET[let_];
      out.push({
        id: uid(), company, name: `${FIRST[(i + ci * 3) % FIRST.length]} ${LAST[(i * 5 + ci) % LAST.length]}`,
        let_level: String(let_), grade: String(8 + let_), gender: i % 2 ? 'F' : 'M',
        cadet_rank: ranks[i % ranks.length], is_board_seat: false,
      });
    }
    ['co', 'xo', '1sg'].forEach((seat, k) => out.push({
      id: uid(), company, name: `${['Cpt', '1Lt', '1Sg'][k]} ${LAST[(ci * 4 + k) % LAST.length]} (${seat.toUpperCase()})`,
      let_level: '3', grade: '11', cadet_rank: ['CPT', '1LT', '1SG'][k], is_board_seat: true,
    }));
  });
  return out;
}

function loadStored() {
  try { return JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null'); } catch { return null; }
}

export function createDemoApi(roleParam) {
  const role = roleParam === 'co' ? 'alpha' : roleParam;
  const stored = loadStored();
  const db = stored ?? {
    quarter: { id: uid(), label: '2026-27 Q1', status: 'open', opened_at: now() },
    roster: makeRoster(),
    sessions: [],
    sheets: [],
    signoffs: [],
  };
  const persist = () => { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch { /* in-memory only */ } };
  const members = COMPANIES.flatMap((c, ci) => ['co', 'xo', '1sg'].map((seat, k) => ({
    email: `${seat}.${c}@demo`, display_name: `${['Cpt', '1Lt', '1Sg'][k]} ${LAST[(ci * 4 + k) % LAST.length]}`,
    board_role: seat, company: c, active: true, has_pin: true,
  })));
  members.push({ email: 'sai@demo', display_name: 'Chief (SAI)', board_role: 'sai', company: null, active: true, has_pin: true });
  const me = role === 'sai' ? members.at(-1) : role === 'viewer'
    ? { email: 'view@demo', display_name: 'S-1 Viewer', board_role: 'viewer', company: null }
    : members.find((m) => m.company === (COMPANIES.includes(role) ? role : 'alpha') && m.board_role === 'co');

  // Pre-fill Bravo/Charlie with a signed board so the SAI view has data.
  function seed(company, count) {
    const s = { id: uid(), quarter_id: db.quarter.id, company, status: 'signed', opened_at: now(), signed_at: now(), seal: 'demo'.padEnd(64, 'f') };
    ['1sg', 'xo', 'co'].forEach((seat) => {
      const m = members.find((x) => x.company === company && x.board_role === seat);
      Object.assign(s, { [`sig_${seat}_name`]: m.display_name, [`sig_${seat}_at`]: now() });
    });
    db.sessions.push(s);
    db.roster.filter((c) => c.company === company && !c.is_board_seat).slice(0, count).forEach((c, i) => {
      const v = (n) => [3, 2, 3, 1, 2, 3, 0, 2][(i + n) % 8];
      const scores = { score_facing: v(0), score_creed: v(1), score_uniform: v(2), score_jrotc: v(3), score_class: v(4) };
      const rank = c.cadet_rank ?? 'PVT';
      const elig = promotionEligibility({ scores, currentRank: rank, letLevel: c.let_level });
      const ladder = { PVT: 'PV2', PV2: 'PFC', PFC: 'CPL', CPL: 'SGT', SGT: 'SSG', SSG: 'SFC', SFC: 'MSG' };
      db.sheets.push({
        id: uid(), quarter_id: db.quarter.id, session_id: s.id, cadet_id: c.id, cadet_name: c.name, company,
        let_level: String(normalizeLet(c.let_level)), grade: c.grade, rank_before: rank, ...scores, total: totalScore(scores),
        decision: elig.eligible ? 'promote' : 'no_promote', promote_to: elig.eligible ? ladder[rank] : null,
        comment: i === 2 ? 'Strong creed, needs work on uniform standards.' : null,
        status: 'complete', locked: true, seal: uid().replace(/-/g, '').padEnd(64, '0'), created_at: now(), completed_at: now(),
      });
    });
  }
  if (!stored) {
    seed('bravo', 16);
    seed('charlie', 11);
    persist();
  }

  const clone = (x) => JSON.parse(JSON.stringify(x));
  const delay = (v) => { persist(); return new Promise((r) => setTimeout(() => r(clone(v)), 120)); };
  const fail = (msg, body) => { const e = new Error(msg); e.body = body; return Promise.reject(e); };

  function results() {
    return db.sheets.map((s) => {
      const ss = db.sessions.find((x) => x.id === s.session_id) ?? {};
      const so = db.signoffs.find((x) => x.company === s.company);
      const final = s.sai_decision ?? s.decision;
      return {
        ...s, final_decision: final, final_promote_to: final === 'promote' ? (s.sai_promote_to ?? s.promote_to) : null,
        quarter_label: db.quarter.label, sig_1sg_name: ss.sig_1sg_name, sig_1sg_at: ss.sig_1sg_at, sig_xo_name: ss.sig_xo_name,
        sig_xo_at: ss.sig_xo_at, sig_co_name: ss.sig_co_name, sig_co_at: ss.sig_co_at, session_status: ss.status,
        sai_signed_name: so?.signed_name, sai_signed_at: so?.signed_at,
      };
    });
  }

  function openSession(company) {
    let s = db.sessions.find((x) => x.company === company && x.status === 'open');
    if (!s) { s = { id: uid(), quarter_id: db.quarter.id, company, status: 'open', opened_at: now() }; db.sessions.push(s); }
    return s;
  }

  return {
    signIn: () => Promise.resolve(),
    signOut: () => { window.location.href = '/boards/sandbox'; return Promise.resolve(); },
    session: () => Promise.resolve({ demo: true }),
    whoami: () => delay([{ ...me, is_s6: role === 'viewer' }]),
    roster: (company) => delay(db.roster.filter((c) => c.company === company)),
    setRank: (id, rank) => { db.roster.find((c) => c.id === id).cadet_rank = rank; return delay(null); },
    currentSession: () => delay(openSession(me.company)),
    saveSheet: (p) => {
      const cadet = db.roster.find((c) => c.id === p.cadet_id);
      if (p.rank_before) cadet.cadet_rank = p.rank_before;
      const s = openSession(cadet.company);
      let row = p.id ? db.sheets.find((x) => x.id === p.id) : null;
      if (!row) { row = { id: uid(), quarter_id: db.quarter.id, session_id: s.id, cadet_id: cadet.id, cadet_name: cadet.name, company: cadet.company, let_level: String(normalizeLet(cadet.let_level)), grade: cadet.grade, created_at: now(), locked: false }; db.sheets.push(row); }
      Object.assign(row, { ...p, id: row.id, total: totalScore(p), rank_before: p.rank_before ?? row.rank_before, completed_at: p.status === 'complete' ? now() : null });
      return delay(row);
    },
    discardSheet: (id) => { db.sheets = db.sheets.filter((s) => s.id !== id); return delay(null); },
    saiReview: (id, decision, promoteTo, note) => {
      Object.assign(db.sheets.find((s) => s.id === id), { sai_decision: decision, sai_promote_to: promoteTo, sai_note: note, sai_action: decision ? 'overturn' : null });
      return delay(null);
    },
    openQuarter: (label) => { db.quarter = { ...db.quarter, label }; return delay(db.quarter); },
    closeQuarter: () => { db.quarter.status = 'closed'; return delay(null); },
    memberStatus: () => delay(members),
    quarters: () => delay([db.quarter]),
    sessions: (_q, company) => delay(db.sessions.filter((s) => !company || s.company === company)),
    sheets: (_q, company) => delay(db.sheets.filter((s) => !company || s.company === company)),
    results: () => delay(results()),
    signoffs: () => delay(db.signoffs),
    members: () => delay(members),
    cadetsWithEmail: (company) => delay(db.roster.filter((c) => c.company === company).map((c) => ({ ...c, school_email: `${c.id.slice(0, 6)}@demo` }))),
    signSession: (sessionId, seat, pin) => {
      if (pin !== '1234') return fail('invalid', { error: 'invalid', remaining: 4 });
      const s = db.sessions.find((x) => x.id === sessionId);
      const m = members.find((x) => x.company === s.company && x.board_role === seat);
      Object.assign(s, { [`sig_${seat}_name`]: m.display_name, [`sig_${seat}_at`]: now() });
      if (seat === 'co') {
        s.status = 'signed'; s.signed_at = now(); s.seal = uid().replace(/-/g, '').repeat(2);
        db.sheets.filter((x) => x.session_id === s.id).forEach((x) => { x.locked = true; x.seal = uid().replace(/-/g, '').repeat(2); });
      }
      return delay({ ok: true, session: s });
    },
    saiSignoff: (_q, company, pin) => {
      if (pin !== '1234') return fail('invalid', { error: 'invalid', remaining: 4 });
      const promos = results().filter((r) => r.company === company && r.final_decision === 'promote').length;
      const so = { id: uid(), company, signed_name: 'Chief (SAI)', signed_at: now(), promotions_applied: promos };
      db.signoffs.push(so);
      return delay({ ok: true, signoff: so });
    },
    setOwnPin: () => delay({ ok: true }),
    adminMember: () => delay({ ok: true }),
  };
}
