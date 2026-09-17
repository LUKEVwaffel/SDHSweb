import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import BallDressLogin from './BallDressLogin';
import '../../review/review.css';
import '../portal.css';

function byLine(email) {
  return email ? email.split('@')[0] : '';
}

// Dress approval portal — female cadets + female guests + female VIP guests
// + female VIP dates (visiting XO/BC/CSM and past King/Queen are the VIPs;
// only a King/Queen may bring a date — see ball_vip_signup.sql) in one
// queue, tagged which is which (approval happens over text, off-platform;
// the verifiers just need to know who they're texting). Reads
// ball_signups_dress_view / ball_guests_dress_view / ball_vip_signups_dress_view
// / ball_vip_dates_dress_view (RLS-scoped: no payment, no POC, no
// allergies). Write is a direct column-guarded UPDATE. Approved sits
// collapsed (names hidden) at the top in green; click to expand and see
// who signed off. Pending is the open, actionable list below it.
export default function BallDressPortal() {
  const [phase, setPhase] = useState('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [email, setEmail] = useState('');
  const [cadets, setCadets] = useState([]);
  const [guests, setGuests] = useState([]);
  const [vips, setVips] = useState([]);
  const [vipDates, setVipDates] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [q, setQ] = useState('');
  const [approvedOpen, setApprovedOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  const loadAll = useCallback(async () => {
    const [{ data: c, error: cErr }, { data: g, error: gErr }, { data: v, error: vErr }, { data: vd, error: vdErr }] = await Promise.all([
      SB.from('ball_signups_dress_view').select('*').eq('cadet_gender', 'female'),
      SB.from('ball_guests_dress_view').select('*').eq('gender', 'female'),
      SB.from('ball_vip_signups_dress_view').select('*').eq('gender', 'female'),
      SB.from('ball_vip_dates_dress_view').select('*').eq('gender', 'female'),
    ]);
    if (cErr || gErr || vErr || vdErr) { setPhase('error'); setErrorMsg((cErr || gErr || vErr || vdErr).message); return; }
    setCadets(c || []);
    setGuests(g || []);
    setVips(v || []);
    setVipDates(vd || []);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ball_vip_signups' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ball_vip_dates' }, loadAll)
      .subscribe();
    return () => { SB.removeChannel(channel); };
  }, [phase, loadAll]);

  async function signOut() {
    await SB.auth.signOut();
    setCadets([]); setGuests([]); setVips([]); setVipDates([]); setEmail('');
    setPhase('login');
  }

  const KIND_TABLE = {
    cadet: 'ball_signups', guest: 'ball_guests', vip: 'ball_vip_signups', vipdate: 'ball_vip_dates',
  };

  async function toggle(item) {
    setBusyId(item.id);
    setActionError('');
    const { data: { session } } = await SB.auth.getSession();
    if (!session) {
      setBusyId(null);
      setLoginNotice('Your session expired — sign in again to keep approving.');
      setPhase('login');
      return;
    }
    const approving = !item.dress_approved;
    const { error } = await SB.from(KIND_TABLE[item.kind]).update({
      dress_approved: approving, dress_approved_by: approving ? session.user.email : null,
    }).eq('id', item.id);
    if (error) {
      setActionError(`Could not update ${item.name}: ${error.message}`);
      setBusyId(null);
      return;
    }
    await loadAll();
    setBusyId(null);
  }

  const { pending, approved, total } = useMemo(() => {
    const items = [
      ...cadets.map((c) => ({ ...c, kind: 'cadet', name: c.cadet_name })),
      ...guests.map((g) => ({ ...g, kind: 'guest' })),
      ...vips.map((v) => ({ ...v, kind: 'vip' })),
      ...vipDates.map((d) => ({ ...d, kind: 'vipdate' })),
    ];
    const term = q.trim().toLowerCase();
    const v = term ? items.filter((x) => (x.name || '').toLowerCase().includes(term)) : items;
    const byName = (a, b) => (a.name || '').localeCompare(b.name || '');
    return {
      pending: v.filter((x) => !x.dress_approved).sort(byName),
      approved: v.filter((x) => x.dress_approved).sort(byName),
      total: items.length,
    };
  }, [cadets, guests, vips, vipDates, q]);

  async function approveAllPending() {
    if (!pending.length) return;
    const ok = window.confirm(`Mark all ${pending.length} pending as approved?`);
    if (!ok) return;
    setBulkBusy(true);
    setActionError('');
    const { data: { session } } = await SB.auth.getSession();
    if (!session) {
      setBulkBusy(false);
      setLoginNotice('Your session expired — sign in again to keep approving.');
      setPhase('login');
      return;
    }
    const byKind = (k) => pending.filter((x) => x.kind === k && !(k === 'guest' && !x.verified_at)).map((x) => x.id);
    const results = await Promise.all(Object.entries(KIND_TABLE).map(([kind, table]) => {
      const ids = byKind(kind);
      return ids.length ? SB.from(table).update({ dress_approved: true, dress_approved_by: session.user.email }).in('id', ids) : null;
    }));
    const failed = results.find((r) => r?.error);
    if (failed) setActionError(`Could not approve all: ${failed.error.message}`);
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

      {actionError && <div className="bp-action-error">{actionError}</div>}

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
          <ApprovedSection
            approved={approved}
            open={approvedOpen}
            onToggleOpen={() => setApprovedOpen((o) => !o)}
            busyId={busyId}
            onToggleRow={toggle}
          />
          <Section title={`To approve · ${pending.length}`} hide={!pending.length} action={pending.length > 1 ? { label: bulkBusy ? 'Approving…' : 'Approve all', onClick: approveAllPending, disabled: bulkBusy } : null}>
            {pending.map((x) => <DressRow key={`${x.kind}-${x.id}`} x={x} busy={busyId === x.id} onToggle={toggle} state="alert" />)}
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

// Collapsed by default so an approved attendee's name isn't sitting out on
// screen — just a green count. Clicking it opens the full list.
function ApprovedSection({ approved, open, onToggleOpen, busyId, onToggleRow }) {
  if (!approved.length) return null;
  return (
    <div className="bp-section">
      <button type="button" className="bp-section-head bp-section-head-btn is-done" onClick={onToggleOpen}>
        <span>✓ Approved · {approved.length}</span>
        <span className="bp-chevron">{open ? '▲ hide' : '▼ view all'}</span>
      </button>
      {open && approved.map((x) => (
        <DressRow key={`${x.kind}-${x.id}`} x={x} busy={busyId === x.id} onToggle={onToggleRow} state="done" />
      ))}
    </div>
  );
}

const KIND_TAG = { cadet: 'cadet', guest: 'guest', vip: 'vip', vipdate: 'vip date' };

function DressRow({ x, busy, onToggle, state }) {
  const [showPhone, setShowPhone] = useState(false);
  const unverified = x.kind === 'guest' && !x.verified_at;
  return (
    <div className={`bp-row is-${state}`}>
      <div className="bp-row-main">
        <div>
          <button
            type="button"
            className={`bp-name bp-name-btn ${x.dress_approved ? 'is-approved' : ''}`}
            onClick={() => setShowPhone((s) => !s)}
            disabled={unverified || !x.phone}
            title={unverified ? 'Guest has not verified yet' : x.phone ? 'Show phone number' : 'No phone on file'}
          >
            {x.name}
          </button>
          <span className="bp-tag">{KIND_TAG[x.kind] || x.kind}</span>
        </div>
        {showPhone && !unverified && (
          <div className="bp-phone">
            {x.phone ? <a href={`tel:${x.phone}`}>{x.phone}</a> : 'No phone on file'}
          </div>
        )}
        {x.kind === 'cadet' && (
          <div className="bp-meta">LET {x.cadet_let_level || '--'} · {(x.cadet_company || '').toUpperCase()}</div>
        )}
        {x.kind === 'vip' && (
          <div className="bp-meta">{x.role === 'past_king_queen' ? 'Past King/Queen' : 'Visiting XO/BC/CSM'} · {x.home_school}</div>
        )}
        {x.kind === 'vipdate' && (
          <div className="bp-meta">date of a past King/Queen</div>
        )}
        {unverified && (
          <div className="bp-meta bp-unverified">awaiting guest email verification</div>
        )}
        {x.dress_approved && x.dress_approved_by && (
          <div className="bp-by">signed off by {byLine(x.dress_approved_by)}</div>
        )}
      </div>
      <div className="bp-actions">
        <button className={`bp-toggle ${x.dress_approved ? 'is-on' : ''}`} disabled={busy || unverified} onClick={() => onToggle(x)}>
          {unverified ? 'Not verified yet' : x.dress_approved ? '✓ Approved' : 'Mark approved'}
        </button>
      </div>
    </div>
  );
}
