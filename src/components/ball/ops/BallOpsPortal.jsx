import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import ReviewLogin from '../../review/ReviewLogin';
import '../../review/review.css';

// Ball Ops portal — Kaz/Chief payment + field trip form tracking. Reuses the
// EXISTING reviewer PIN/password login wholesale (ReviewLogin.jsx, same
// email_reviewers population + reviewer-pin-login edge fn as the email
// review portal) rather than a new login screen, per product decision — this
// is the same 3 people, just a second surface for them. Reads through
// ball_signups_ops_view / ball_guests_ops_view (RLS-scoped, no dress fields,
// no allergies — see ball_signup.sql). Writes go directly to the base table
// under the column-guard trigger; the notification email is a
// fire-and-forget call to notify-ball-status-update afterward.
export default function BallOpsPortal() {
  const [phase, setPhase] = useState('checking'); // checking | login | ready | error
  const [errorMsg, setErrorMsg] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [rows, setRows] = useState([]);
  const [guestsBySignup, setGuestsBySignup] = useState({});
  const [busyId, setBusyId] = useState(null);

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

  const pending = rows.filter((r) => r.status === 'guest_pending');
  const verified = rows.filter((r) => r.status === 'fully_verified');

  return shell(
    <div>
      <h1 className="rv-h1" style={{ fontSize: 22, margin: '4px 0 4px' }}>Ball Signups</h1>
      <p className="rv-sub" style={{ marginBottom: 22 }}>{verified.length} fully verified · {pending.length} awaiting guest</p>

      <div className="rv-list">
        {pending.map((r) => (
          <div key={r.id} className="rv-card" style={{ padding: '14px 18px' }}>
            <div className="rv-row-title">{r.cadet_name}</div>
            <div className="rv-row-meta">LET {r.cadet_let_level || '—'} · {(r.cadet_company || '').toUpperCase()} · Guest Pending</div>
          </div>
        ))}
        {verified.map((r) => {
          const guest = guestsBySignup[r.id];
          return (
            <div key={r.id} className="rv-card" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div>
                  <div className="rv-row-title">{r.cadet_name}</div>
                  <div className="rv-row-meta">
                    LET {r.cadet_let_level || '—'} · {(r.cadet_company || '').toUpperCase()} · Guest: {guest?.name || '—'} ({guest?.age ?? '—'})
                  </div>
                </div>
                <span className="rv-chip approve">Fully Verified</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className={`rv-btn ${r.cash_received ? 'approve' : ''}`} disabled={busyId === r.id} onClick={() => toggle(r, 'cash_received')}>
                  {r.cash_received ? '✓ CASH RECEIVED' : 'MARK CASH RECEIVED'}
                </button>
                <button className={`rv-btn ${r.field_trip_form_received ? 'approve' : ''}`} disabled={busyId === r.id} onClick={() => toggle(r, 'field_trip_form_received')}>
                  {r.field_trip_form_received ? '✓ FORM RECEIVED' : 'MARK FORM RECEIVED'}
                </button>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div className="rv-card rv-empty">No signups yet.</div>}
      </div>
    </div>
  );
}
