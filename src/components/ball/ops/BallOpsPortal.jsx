import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import ReviewLogin from '../../review/ReviewLogin';
import '../../review/review.css';
import '../portal.css';

function money(n) {
  return n == null ? null : `$${Number(n).toFixed(Number.isInteger(Number(n)) ? 0 : 2)}`;
}

// Ball Ops portal — Kaz/Chief payment + field trip form tracking. Reuses the
// EXISTING reviewer PIN/password login wholesale (ReviewLogin.jsx, same
// email_reviewers population + reviewer-pin-login edge fn as the email review
// portal) — same 3 people, second surface. Reads through
// ball_signups_ops_view / ball_guests_ops_view (RLS-scoped, no dress fields,
// no allergies). Writes go directly to the base table under the column-guard
// trigger, then a fire-and-forget notify-ball-status-update.
//
// Layout: three buckets — NEEDS ACTION (verified, still owes cash or form),
// AWAITING GUEST (guest hasn't finished their part), SETTLED (done, dimmed).
export default function BallOpsPortal() {
  const [phase, setPhase] = useState('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [rows, setRows] = useState([]);
  const [guestsBySignup, setGuestsBySignup] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [q, setQ] = useState('');

  const loadAll = useCallback(async () => {
    const [{ data: signups, error: sErr }, { data: guests, error: gErr }] = await Promise.all([
      SB.from('ball_signups_ops_view').select('*').order('created_at', { ascending: true }),
      SB.from('ball_guests_ops_view').select('*'),
    ]);
    if (sErr || gErr) { setPhase('error'); setErrorMsg((sErr || gErr).message); return; }
    const bySignup = {};
    (guests || []).forEach((g) => { bySignup[g.signup_id] = g; });
    setGuestsBySignup(bySignup);
    setRows(signups || []);
    setPhase('ready');
  }, []);

  const verifyAndLoad = useCallback(async () => {
    const { data: { session } } = await SB.auth.getSession();
    if (!session) { setPhase('login'); return; }
    const { data: rev } = await SB.from('email_reviewers')
      .select('email').eq('email', session.user.email.toLowerCase()).eq('active', true).maybeSingle();
    if (!rev) { setLoginNotice('That account is not an active ops reviewer.'); setPhase('login'); return; }
    await loadAll();
  }, [loadAll]);

  useEffect(() => { verifyAndLoad(); }, [verifyAndLoad]);

  async function toggle(row, field) {
    setBusyId(row.id);
    const nextValue = !row[field];
    const { error } = await SB.from('ball_signups').update({ [field]: nextValue }).eq('id', row.id);
    if (!error) {
      await SB.functions.invoke('notify-ball-status-update', { body: { signup_id: row.id, field: field === 'cash_received' ? 'cash' : 'form' } });
      await loadAll();
    }
    setBusyId(null);
  }

  const settled = (r) => r.cash_received && (!r.field_trip_form_required || r.field_trip_form_received);

  const { needsAction, awaiting, done } = useMemo(() => {
    const term = q.trim().toLowerCase();
    const match = (r) => {
      if (!term) return true;
      const g = guestsBySignup[r.id];
      return (r.cadet_name || '').toLowerCase().includes(term) || (g?.name || '').toLowerCase().includes(term);
    };
    const v = rows.filter(match);
    return {
      needsAction: v.filter((r) => r.status === 'fully_verified' && !settled(r)),
      awaiting: v.filter((r) => r.status === 'guest_pending'),
      done: v.filter((r) => r.status === 'fully_verified' && settled(r)),
    };
  }, [rows, guestsBySignup, q]);

  const shell = (children) => (
    <div className="rv">
      <div className="rv-shell">
        <div className="rv-eyebrow">Trojan Battalion · Ball Ops</div>
        {children}
      </div>
    </div>
  );

  if (phase === 'checking') return shell(<p className="rv-sub"><span className="rv-dot" />Checking your session&hellip;</p>);
  if (phase === 'login') return shell(<ReviewLogin notice={loginNotice || 'Sign in to Ball Ops (same account as email review).'} onSignedIn={verifyAndLoad} />);
  if (phase === 'error') return shell(<div className="rv-panel" style={{ borderColor: '#dcbdb6' }}><h1 className="rv-h1" style={{ fontSize: 20 }}>Something went wrong</h1><p className="rv-sub">{errorMsg}</p></div>);

  const totalVerified = rows.filter((r) => r.status === 'fully_verified').length;

  return shell(
    <div>
      <div className="bp-head">
        <h1 className="bp-title">Ball Payments</h1>
        <button className="bp-refresh" onClick={loadAll}>Refresh</button>
      </div>

      <div className="bp-stats">
        <span className={`bp-stat ${needsAction.length ? 'is-alert' : ''}`}><b>{needsAction.length}</b> need action</span>
        <span className="bp-stat"><b>{awaiting.length}</b> awaiting guest</span>
        <span className={`bp-stat ${done.length === totalVerified && totalVerified > 0 ? 'is-done' : ''}`}><b>{done.length}</b> settled</span>
      </div>

      {rows.length > 6 && (
        <input className="bp-search" placeholder="Search by cadet or guest name…" value={q} onChange={(e) => setQ(e.target.value)} />
      )}

      {rows.length === 0 ? (
        <div className="bp-empty">No signups yet.</div>
      ) : (
        <>
          <Section title={`Needs action · ${needsAction.length}`} hide={!needsAction.length}>
            {needsAction.map((r) => <OpsRow key={r.id} r={r} guest={guestsBySignup[r.id]} busy={busyId === r.id} onToggle={toggle} state="alert" />)}
          </Section>
          <Section title={`Awaiting guest · ${awaiting.length}`} hide={!awaiting.length}>
            {awaiting.map((r) => <OpsRow key={r.id} r={r} guest={guestsBySignup[r.id]} busy={busyId === r.id} onToggle={toggle} state="wait" />)}
          </Section>
          <Section title={`Settled · ${done.length}`} hide={!done.length}>
            {done.map((r) => <OpsRow key={r.id} r={r} guest={guestsBySignup[r.id]} busy={busyId === r.id} onToggle={toggle} state="done" />)}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, hide, children }) {
  if (hide) return null;
  return (
    <div className="bp-section">
      <div className="bp-section-head">{title}</div>
      {children}
    </div>
  );
}

function OpsRow({ r, guest, busy, onToggle, state }) {
  const friend = guest?.guest_type === 'friend';
  return (
    <div className={`bp-row is-${state}`}>
      <div className="bp-row-main">
        <div>
          <span className="bp-name">{r.cadet_name}</span>
          {guest?.guest_type && <span className="bp-tag">{guest.guest_type}</span>}
        </div>
        <div className="bp-meta">
          LET {r.cadet_let_level || '--'} · {(r.cadet_company || '').toUpperCase()}
          {guest?.name ? ` · guest ${guest.name}${guest.age != null ? ` (${guest.age})` : ''}` : ''}
        </div>
        <div className="bp-facts">
          <span className="bp-fact">Host owes <b>{money(r.amount_due) || 'TBD'}</b></span>
          {friend && (
            <span className="bp-fact">
              Friend owes <b>{money(guest.friend_amount_due) || 'TBD'}</b>
              {' '}({guest.friend_payment_method === 'host_delivers' ? 'host brings it' : 'friend pays direct'})
            </span>
          )}
          {!r.field_trip_form_required && <span className="bp-fact">no field trip form</span>}
        </div>
      </div>

      {state !== 'wait' && (
        <div className="bp-actions">
          <button className={`bp-toggle ${r.cash_received ? 'is-on' : ''}`} disabled={busy} onClick={() => onToggle(r, 'cash_received')}>
            {r.cash_received ? '✓ Cash' : 'Cash'}
          </button>
          {r.field_trip_form_required && (
            <button className={`bp-toggle ${r.field_trip_form_received ? 'is-on' : ''}`} disabled={busy} onClick={() => onToggle(r, 'field_trip_form_received')}>
              {r.field_trip_form_received ? '✓ Form' : 'Form'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
