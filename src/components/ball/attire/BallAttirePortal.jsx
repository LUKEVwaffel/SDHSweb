import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import BallDressLogin from '../dress/BallDressLogin';
import '../../review/review.css';
import '../portal.css';

function byLine(email) {
  return email ? email.split('@')[0] : '';
}

// Male-guest attire portal — Weston's queue ONLY. Separate from the female
// dress approvers (/ball/dress) and Kaz/Chief's payment queue (/ball/ops).
// Auth reuses the ball_dress_staff PIN login; Weston's row carries
// role='male_guest_attire', gated by is_ball_attire(). Read is
// ball_attire_guest_list() (SECURITY DEFINER, male guests only). Write is a
// direct column-guarded UPDATE on ball_guests — no notification email
// (approval already happened over text).
export default function BallAttirePortal() {
  const [phase, setPhase] = useState('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [email, setEmail] = useState('');
  const [rows, setRows] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [q, setQ] = useState('');

  const loadAll = useCallback(async () => {
    const { data, error } = await SB.rpc('ball_attire_guest_list');
    if (error) { setPhase('error'); setErrorMsg(error.message); return; }
    setRows(data || []);
    setPhase('ready');
  }, []);

  const verifyAndLoad = useCallback(async () => {
    const { data: { session } } = await SB.auth.getSession();
    if (!session) { setPhase('login'); return; }
    const { data: ok } = await SB.rpc('is_ball_attire');
    if (!ok) { setLoginNotice('That account is not the male-guest attire approver.'); setPhase('login'); return; }
    setEmail(session.user.email);
    await loadAll();
  }, [loadAll]);

  useEffect(() => { verifyAndLoad(); }, [verifyAndLoad]);

  // Live refresh: a new male guest, or a change from the dress portal, shows
  // up without a manual reload.
  useEffect(() => {
    if (phase !== 'ready') return undefined;
    const channel = SB.channel('ball-attire-portal')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ball_guests' }, loadAll)
      .subscribe();
    return () => { SB.removeChannel(channel); };
  }, [phase, loadAll]);

  async function signOut() {
    await SB.auth.signOut();
    setRows([]); setEmail('');
    setPhase('login');
  }

  async function toggle(row) {
    setBusyId(row.id);
    const { data: { session } } = await SB.auth.getSession();
    const approving = !row.dress_approved;
    await SB.from('ball_guests').update({
      dress_approved: approving, dress_approved_by: approving ? session.user.email : null,
    }).eq('id', row.id);
    await loadAll();
    setBusyId(null);
  }

  const { pending, approved } = useMemo(() => {
    const term = q.trim().toLowerCase();
    const v = term
      ? rows.filter((r) => (r.guest_name || '').toLowerCase().includes(term) || (r.cadet_name || '').toLowerCase().includes(term))
      : rows;
    const byName = (a, b) => (a.guest_name || '').localeCompare(b.guest_name || '');
    return { pending: v.filter((r) => !r.dress_approved).sort(byName), approved: v.filter((r) => r.dress_approved).sort(byName) };
  }, [rows, q]);

  async function approveAllPending() {
    if (!pending.length) return;
    const ok = window.confirm(`Mark all ${pending.length} pending as approved?`);
    if (!ok) return;
    setBulkBusy(true);
    const { data: { session } } = await SB.auth.getSession();
    await SB.from('ball_guests').update({
      dress_approved: true, dress_approved_by: session.user.email,
    }).in('id', pending.map((r) => r.id));
    await loadAll();
    setBulkBusy(false);
  }

  const shell = (children) => (
    <div className="rv">
      <div className="rv-shell">
        <div className="rv-eyebrow">Trojan Battalion · Male-Guest Attire</div>
        {children}
      </div>
    </div>
  );

  if (phase === 'checking') return shell(<p className="rv-sub"><span className="rv-dot" />Checking your session&hellip;</p>);
  if (phase === 'login') return shell(<BallDressLogin heading="Male-Guest Attire" notice={loginNotice} onSignedIn={verifyAndLoad} />);
  if (phase === 'error') return shell(<div className="rv-panel" style={{ borderColor: '#dcbdb6' }}><h1 className="rv-h1" style={{ fontSize: 20 }}>Something went wrong</h1><p className="rv-sub">{errorMsg}</p></div>);

  return shell(
    <div>
      <div className="bp-session">
        <span className="bp-session-email">{email}</span>
        <button className="bp-signout" onClick={signOut}>Sign out</button>
      </div>

      <div className="bp-head">
        <h1 className="bp-title">Male-Guest Attire</h1>
        <button className="bp-refresh" onClick={loadAll}>Refresh</button>
      </div>

      <div className="bp-stats">
        <span className={`bp-stat ${pending.length ? 'is-alert' : ''}`}><b>{pending.length}</b> to approve</span>
        <span className={`bp-stat ${approved.length === rows.length && rows.length > 0 ? 'is-done' : ''}`}><b>{approved.length}</b> approved</span>
      </div>

      {rows.length > 6 && (
        <input className="bp-search" placeholder="Search by guest or host name…" value={q} onChange={(e) => setQ(e.target.value)} />
      )}

      {rows.length === 0 ? (
        <div className="bp-empty">No male guests to review yet.</div>
      ) : (
        <>
          <Section title={`To approve · ${pending.length}`} hide={!pending.length} action={pending.length > 1 ? { label: bulkBusy ? 'Approving…' : 'Approve all', onClick: approveAllPending, disabled: bulkBusy } : null}>
            {pending.map((r) => <AttireRow key={r.id} r={r} busy={busyId === r.id} onToggle={toggle} state="alert" />)}
          </Section>
          <Section title={`Approved · ${approved.length}`} hide={!approved.length}>
            {approved.map((r) => <AttireRow key={r.id} r={r} busy={busyId === r.id} onToggle={toggle} state="done" />)}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, hide, children, action }) {
  if (hide) return null;
  return (
    <div className="bp-section">
      <div className="bp-section-head">
        {title}
        {action && (
          <button className="bp-bulk" disabled={action.disabled} onClick={action.onClick}>{action.label}</button>
        )}
      </div>
      {children}
    </div>
  );
}

function AttireRow({ r, busy, onToggle, state }) {
  return (
    <div className={`bp-row is-${state}`}>
      <div className="bp-row-main">
        <div>
          <span className="bp-name">{r.guest_name}</span>
          <span className="bp-tag">male guest</span>
        </div>
        <div className="bp-meta">guest of {r.cadet_name}</div>
        {r.dress_approved && r.dress_approved_by && (
          <div className="bp-by">signed off by {byLine(r.dress_approved_by)}</div>
        )}
      </div>
      <div className="bp-actions">
        <button className={`bp-toggle ${r.dress_approved ? 'is-on' : ''}`} disabled={busy} onClick={() => onToggle(r)}>
          {r.dress_approved ? '✓ Approved' : 'Mark approved'}
        </button>
      </div>
    </div>
  );
}
