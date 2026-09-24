import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase as SB } from '../../../lib/supabaseClient';
import PortalMovedNotice from '../../portal/PortalMovedNotice';
import { isPortalMoveNoticeActive } from '../../portal/portalMoveConfig';
import { ERROR_CODES, reportError } from '../../../lib/errorCodes';
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
  const [deniedMsg, setDeniedMsg] = useState('');
  const [actionError, setActionError] = useState('');
  const [email, setEmail] = useState('');
  const [rows, setRows] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [q, setQ] = useState('');

  const loadAll = useCallback(async () => {
    const { data, error } = await SB.rpc('ball_attire_guest_list');
    if (error) {
      setPhase('error');
      setErrorMsg(reportError(ERROR_CODES.BALL_ATTIRE_LOAD_FAILED, 'ball_attire', error.message, {
        detail: { supabase_error: error }, context: { source: 'ball_attire_guest_list' },
      }));
      return;
    }
    setRows(data || []);
    setPhase('ready');
  }, []);

  const verifyAndLoad = useCallback(async () => {
    const { data: { session } } = await SB.auth.getSession();
    if (!session) { setPhase('login'); return; }
    const { data: ok, error: okErr } = await SB.rpc('is_ball_attire');
    if (okErr) {
      setPhase('error');
      setErrorMsg(reportError(ERROR_CODES.BALL_ATTIRE_LOAD_FAILED, 'ball_attire', okErr.message, {
        detail: { supabase_error: okErr }, context: { stage: 'is_ball_attire', email: session.user.email },
      }));
      return;
    }
    if (!ok) {
      setDeniedMsg(reportError(ERROR_CODES.BALL_ATTIRE_NOT_AUTHORIZED, 'ball_attire', 'That account is not an active attire approver.', {
        context: { email: session.user.email },
      }));
      setPhase('denied');
      return;
    }
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
    setRows([]); setEmail(''); setDeniedMsg('');
    setPhase('login');
  }

  // "Your attire is approved" email. Fire-and-forget — a failed email must
  // not block or undo the approval itself.
  function notifyApproved(ids) {
    if (!ids.length) return;
    SB.functions.invoke('notify-ball-dress-approved', { body: { kind: 'guest', ids } }).catch(() => {});
  }

  async function toggle(row) {
    setBusyId(row.id);
    setActionError('');
    try {
      const { data: { session } } = await SB.auth.getSession();
      if (!session) { setPhase('login'); return; }
      const approving = !row.dress_approved;
      const { error, count } = await SB.from('ball_guests').update({
        dress_approved: approving, dress_approved_by: approving ? session.user.email : null,
      }, { count: 'exact' }).eq('id', row.id);
      if (error) {
        setActionError(reportError(ERROR_CODES.BALL_ATTIRE_TOGGLE_FAILED, 'ball_attire', `Could not update ${row.guest_name}: ${error.message}`, {
          detail: { supabase_error: error }, context: { id: row.id },
        }));
        return;
      }
      // No error AND no row matched means RLS/the column-guard silently
      // filtered the write instead of raising — reads as success otherwise.
      if (!count) {
        setActionError(reportError(ERROR_CODES.BALL_ATTIRE_TOGGLE_NO_MATCH, 'ball_attire', `Update for ${row.guest_name} was blocked (0 rows changed) — this looks like a permissions issue, not a network drop. Nothing was saved.`, {
          context: { id: row.id },
        }));
        return;
      }
      if (approving) notifyApproved([row.id]);
      await loadAll();
    } catch (e) {
      setActionError(reportError(ERROR_CODES.BALL_ATTIRE_TOGGLE_EXCEPTION, 'ball_attire', `Could not update ${row.guest_name}: ${e?.message || 'connection lost mid-request'}. Try again.`, {
        detail: { thrown: String(e?.message || e) }, context: { id: row.id },
      }));
    } finally {
      setBusyId(null);
    }
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
    setActionError('');
    try {
      const { data: { session } } = await SB.auth.getSession();
      if (!session) { setPhase('login'); return; }
      const ids = pending.map((r) => r.id);
      const { error, count } = await SB.from('ball_guests').update({
        dress_approved: true, dress_approved_by: session.user.email,
      }, { count: 'exact' }).in('id', ids);
      if (error) {
        setActionError(reportError(ERROR_CODES.BALL_ATTIRE_BULK_FAILED, 'ball_attire', `Could not approve all: ${error.message}`, {
          detail: { supabase_error: error }, context: { ids },
        }));
        return;
      }
      if (count) notifyApproved(ids);
      // No error AND fewer rows changed than requested means RLS/the
      // column-guard silently filtered some or all of the writes.
      const shortfall = ids.length - (count || 0);
      if (shortfall > 0) {
        setActionError(reportError(ERROR_CODES.BALL_ATTIRE_BULK_NO_MATCH, 'ball_attire', `${shortfall} of ${ids.length} were blocked (0 rows changed) — this looks like a permissions issue, not a network drop.`, {
          context: { shortfall, requested: ids.length },
        }));
      }
      await loadAll();
    } catch (e) {
      setActionError(reportError(ERROR_CODES.BALL_ATTIRE_BULK_EXCEPTION, 'ball_attire', `Could not approve all: ${e?.message || 'connection lost mid-request'}. Try again.`, {
        detail: { thrown: String(e?.message || e) },
      }));
    } finally {
      setBulkBusy(false);
    }
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
  if (phase === 'login') return isPortalMoveNoticeActive() ? <PortalMovedNotice portalName="Male-Guest Attire" /> : <Navigate to="/portal" replace />;
  if (phase === 'denied') return shell(
    <div className="rv-panel" style={{ borderColor: '#dcbdb6' }}>
      <h1 className="rv-h1" style={{ fontSize: 20 }}>Not authorized</h1>
      <p className="rv-sub">{deniedMsg}</p>
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <a className="rv-link" style={{ margin: 0 }} href="/portal">&lsaquo; Back to portal picker</a>
        <button className="rv-link" style={{ margin: 0 }} onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
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

      {actionError && <div className="bp-action-error">{actionError}</div>}

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
