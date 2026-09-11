import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import BallDressLogin from './BallDressLogin';
import '../../review/review.css';
import '../portal.css';

function byLine(email) {
  return email ? email.split('@')[0] : '';
}

// Dress approval portal — female cadets + female guests in one queue, tagged
// which is which (approval happens over text, off-platform; the verifiers
// just need to know who they're texting). Reads ball_signups_dress_view /
// ball_guests_dress_view (RLS-scoped: no payment, no POC, no allergies).
// Write is a direct column-guarded UPDATE. Pending first; approved collapses
// into a dimmed section with who signed off.
export default function BallDressPortal() {
  const [phase, setPhase] = useState('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [email, setEmail] = useState('');
  const [cadets, setCadets] = useState([]);
  const [guests, setGuests] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [q, setQ] = useState('');

  const loadAll = useCallback(async () => {
    const [{ data: c, error: cErr }, { data: g, error: gErr }] = await Promise.all([
      SB.from('ball_signups_dress_view').select('*').eq('cadet_gender', 'female'),
      SB.from('ball_guests_dress_view').select('*').eq('gender', 'female'),
    ]);
    if (cErr || gErr) { setPhase('error'); setErrorMsg((cErr || gErr).message); return; }
    setCadets(c || []);
    setGuests(g || []);
    setPhase('ready');
  }, []);

  const verifyAndLoad = useCallback(async () => {
    const { data: { session } } = await SB.auth.getSession();
    if (!session) { setPhase('login'); return; }
    const { data: staff } = await SB.rpc('is_ball_dress');
    if (!staff) { setLoginNotice('That account is not an active dress approver.'); setPhase('login'); return; }
    setEmail(session.user.email);
    await loadAll();
  }, [loadAll]);

  useEffect(() => { verifyAndLoad(); }, [verifyAndLoad]);

  // Live refresh: another approver's change (or the guest-verify flow) shows
  // up here without a manual reload.
  useEffect(() => {
    if (phase !== 'ready') return undefined;
    const channel = SB.channel('ball-dress-portal')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ball_signups' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ball_guests' }, loadAll)
      .subscribe();
    return () => { SB.removeChannel(channel); };
  }, [phase, loadAll]);

  async function signOut() {
    await SB.auth.signOut();
    setCadets([]); setGuests([]); setEmail('');
    setPhase('login');
  }

  async function toggle(item) {
    setBusyId(item.id);
    const { data: { session } } = await SB.auth.getSession();
    const approving = !item.dress_approved;
    const table = item.kind === 'cadet' ? 'ball_signups' : 'ball_guests';
    await SB.from(table).update({
      dress_approved: approving, dress_approved_by: approving ? session.user.email : null,
    }).eq('id', item.id);
    await loadAll();
    setBusyId(null);
  }

  const { pending, approved, total } = useMemo(() => {
    const items = [
      ...cadets.map((c) => ({ ...c, kind: 'cadet', name: c.cadet_name })),
      ...guests.map((g) => ({ ...g, kind: 'guest' })),
    ];
    const term = q.trim().toLowerCase();
    const v = term ? items.filter((x) => (x.name || '').toLowerCase().includes(term)) : items;
    const byName = (a, b) => (a.name || '').localeCompare(b.name || '');
    return {
      pending: v.filter((x) => !x.dress_approved).sort(byName),
      approved: v.filter((x) => x.dress_approved).sort(byName),
      total: items.length,
    };
  }, [cadets, guests, q]);

  async function approveAllPending() {
    if (!pending.length) return;
    const ok = window.confirm(`Mark all ${pending.length} pending as approved?`);
    if (!ok) return;
    setBulkBusy(true);
    const { data: { session } } = await SB.auth.getSession();
    const cadetIds = pending.filter((x) => x.kind === 'cadet').map((x) => x.id);
    const guestIds = pending.filter((x) => x.kind === 'guest').map((x) => x.id);
    await Promise.all([
      cadetIds.length ? SB.from('ball_signups').update({ dress_approved: true, dress_approved_by: session.user.email }).in('id', cadetIds) : null,
      guestIds.length ? SB.from('ball_guests').update({ dress_approved: true, dress_approved_by: session.user.email }).in('id', guestIds) : null,
    ]);
    await loadAll();
    setBulkBusy(false);
  }

  const shell = (children) => (
    <div className="rv">
      <div className="rv-shell">
        <div className="rv-eyebrow">Trojan Battalion · Dress Approval</div>
        {children}
      </div>
    </div>
  );

  if (phase === 'checking') return shell(<p className="rv-sub"><span className="rv-dot" />Checking your session&hellip;</p>);
  if (phase === 'login') return shell(<BallDressLogin notice={loginNotice} onSignedIn={verifyAndLoad} />);
  if (phase === 'error') return shell(<div className="rv-panel" style={{ borderColor: '#dcbdb6' }}><h1 className="rv-h1" style={{ fontSize: 20 }}>Something went wrong</h1><p className="rv-sub">{errorMsg}</p></div>);

  return shell(
    <div>
      <div className="bp-session">
        <span className="bp-session-email">{email}</span>
        <button className="bp-signout" onClick={signOut}>Sign out</button>
      </div>

      <div className="bp-head">
        <h1 className="bp-title">Dress Approvals</h1>
        <button className="bp-refresh" onClick={loadAll}>Refresh</button>
      </div>

      <div className="bp-stats">
        <span className={`bp-stat ${pending.length ? 'is-alert' : ''}`}><b>{pending.length}</b> to approve</span>
        <span className={`bp-stat ${approved.length === total && total > 0 ? 'is-done' : ''}`}><b>{approved.length}</b> approved</span>
      </div>

      {total > 6 && (
        <input className="bp-search" placeholder="Search by name…" value={q} onChange={(e) => setQ(e.target.value)} />
      )}

      {total === 0 ? (
        <div className="bp-empty">No one needs dress approval yet.</div>
      ) : (
        <>
          <Section title={`To approve · ${pending.length}`} hide={!pending.length} action={pending.length > 1 ? { label: bulkBusy ? 'Approving…' : 'Approve all', onClick: approveAllPending, disabled: bulkBusy } : null}>
            {pending.map((x) => <DressRow key={`${x.kind}-${x.id}`} x={x} busy={busyId === x.id} onToggle={toggle} state="alert" />)}
          </Section>
          <Section title={`Approved · ${approved.length}`} hide={!approved.length}>
            {approved.map((x) => <DressRow key={`${x.kind}-${x.id}`} x={x} busy={busyId === x.id} onToggle={toggle} state="done" />)}
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

function DressRow({ x, busy, onToggle, state }) {
  return (
    <div className={`bp-row is-${state}`}>
      <div className="bp-row-main">
        <div>
          <span className="bp-name">{x.name}</span>
          <span className="bp-tag">{x.kind}</span>
        </div>
        {x.kind === 'cadet' && (
          <div className="bp-meta">LET {x.cadet_let_level || '--'} · {(x.cadet_company || '').toUpperCase()}</div>
        )}
        {x.dress_approved && x.dress_approved_by && (
          <div className="bp-by">signed off by {byLine(x.dress_approved_by)}</div>
        )}
      </div>
      <div className="bp-actions">
        <button className={`bp-toggle ${x.dress_approved ? 'is-on' : ''}`} disabled={busy} onClick={() => onToggle(x)}>
          {x.dress_approved ? '✓ Approved' : 'Mark approved'}
        </button>
      </div>
    </div>
  );
}
