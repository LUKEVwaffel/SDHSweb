import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import BallDressLogin from './BallDressLogin';
import '../../review/review.css';

// Dress approval portal — combined list of female cadets + female guests,
// clearly labeled which is which since approval happens over text, off
// platform; the verifiers just need to know who they're texting with. Reads
// through ball_signups_dress_view / ball_guests_dress_view (RLS-scoped, no
// payment fields, no guest POC contact info, no allergies). Write is a
// direct column-guarded UPDATE on the base table — no notification email
// (the approval already happened over text).
export default function BallDressPortal() {
  const [phase, setPhase] = useState('checking'); // checking | login | ready | error
  const [errorMsg, setErrorMsg] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [cadets, setCadets] = useState([]);
  const [guests, setGuests] = useState([]);
  const [busyId, setBusyId] = useState(null);

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
    await loadAll();
  }, [loadAll]);

  useEffect(() => { verifyAndLoad(); }, [verifyAndLoad]);

  async function toggleCadet(row) {
    setBusyId(row.id);
    const { data: { session } } = await SB.auth.getSession();
    const approving = !row.dress_approved;
    await SB.from('ball_signups').update({
      dress_approved: approving, dress_approved_by: approving ? session.user.email : null,
    }).eq('id', row.id);
    await loadAll();
    setBusyId(null);
  }

  async function toggleGuest(row) {
    setBusyId(row.id);
    const { data: { session } } = await SB.auth.getSession();
    const approving = !row.dress_approved;
    await SB.from('ball_guests').update({
      dress_approved: approving, dress_approved_by: approving ? session.user.email : null,
    }).eq('id', row.id);
    await loadAll();
    setBusyId(null);
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

  const total = cadets.length + guests.length;
  const approvedCount = cadets.filter((c) => c.dress_approved).length + guests.filter((g) => g.dress_approved).length;

  return shell(
    <div>
      <h1 className="rv-h1" style={{ fontSize: 22, margin: '4px 0 4px' }}>Dress Approvals</h1>
      <p className="rv-sub" style={{ marginBottom: 22 }}>{approvedCount} of {total} approved</p>

      <div className="rv-list">
        {cadets.map((c) => (
          <div key={c.id} className="rv-card" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <div className="rv-row-title">{c.cadet_name} <span className="rv-row-meta">— Cadet</span></div>
              <div className="rv-row-meta">LET {c.cadet_let_level || '—'} · {(c.cadet_company || '').toUpperCase()}</div>
            </div>
            <button className={`rv-btn ${c.dress_approved ? 'approve' : ''}`} disabled={busyId === c.id} onClick={() => toggleCadet(c)}>
              {c.dress_approved ? '✓ APPROVED' : 'MARK APPROVED'}
            </button>
          </div>
        ))}
        {guests.map((g) => (
          <div key={g.id} className="rv-card" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <div className="rv-row-title">{g.name} <span className="rv-row-meta">— guest</span></div>
            </div>
            <button className={`rv-btn ${g.dress_approved ? 'approve' : ''}`} disabled={busyId === g.id} onClick={() => toggleGuest(g)}>
              {g.dress_approved ? '✓ APPROVED' : 'MARK APPROVED'}
            </button>
          </div>
        ))}
        {total === 0 && <div className="rv-card rv-empty">No one needs dress approval yet.</div>}
      </div>
    </div>
  );
}
