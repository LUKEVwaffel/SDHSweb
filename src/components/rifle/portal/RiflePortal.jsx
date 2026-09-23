import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase as SB } from '../../../lib/supabaseClient';
import PortalMovedNotice from '../../portal/PortalMovedNotice';
import { isPortalMoveNoticeActive } from '../../portal/portalMoveConfig';
import RifleForcePasswordChange from './RifleForcePasswordChange';
import RiflePinControl from './RiflePinControl';
import RosterTab from './RosterTab';
import CompUploadTab from './CompUploadTab';
import SignupsTab from './SignupsTab';
import ScoresTab from './ScoresTab';
import StatsTab from './StatsTab';
import HistoryTab from './HistoryTab';
import AskAiTab from './AskAiTab';
import CalendarTab from './CalendarTab';
import { P, mono, oswald } from '../theme';

const TABS = [
  { id: 'roster', label: 'Roster' },
  { id: 'signups', label: 'Signups' },
  { id: 'compupload', label: 'Comp Upload' },
  { id: 'scores', label: 'Scores' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'stats', label: 'Stats' },
  { id: 'history', label: 'History' },
  { id: 'askai', label: 'Ask AI' },
];

// Self-contained portal at /rifle/portal — Makaio's own login, own chrome,
// own phase gate. Not the DISPATCH admin UI: it never touches admin_roles,
// login_accounts, or is_s6()'s picker — this is a completely separate
// account population (rifle_admins) scoped to the rifle domain only.
export default function RiflePortal() {
  const [phase, setPhase] = useState('checking'); // checking | login | force-password | ready | error
  const [admin, setAdmin] = useState(null); // { email, must_change_password }
  const [hasPin, setHasPin] = useState(false);
  const [tab, setTab] = useState('roster');
  const [errorMsg, setErrorMsg] = useState('');

  const verify = useCallback(async () => {
    const { data: { session } } = await SB.auth.getSession();
    if (!session) { setPhase('login'); return; }
    const { data: row, error } = await SB.from('rifle_admin_self').select('*').maybeSingle();
    if (error) { setErrorMsg(error.message); setPhase('error'); return; }
    if (!row || !row.active) {
      await SB.auth.signOut();
      setPhase('login');
      return;
    }
    setAdmin(row);
    if (row.must_change_password) { setPhase('force-password'); return; }

    setHasPin(row.has_pin);
    setPhase('ready');
  }, []);

  useEffect(() => {
    verify();
    const { data: sub } = SB.auth.onAuthStateChange(() => verify());
    return () => sub.subscription.unsubscribe();
  }, [verify]);

  async function signOut() {
    await SB.auth.signOut();
    setAdmin(null);
    setPhase('login');
  }

  const shellStyle = { background: P.ink, minHeight: '100vh', fontFamily: 'Inter, sans-serif' };

  if (phase === 'checking') {
    return <div style={shellStyle}><div style={{ padding: 40, fontFamily: mono, fontSize: 12, color: P.mute }}>Checking your session…</div></div>;
  }
  if (phase === 'login') return isPortalMoveNoticeActive() ? <PortalMovedNotice portalName="Rifle Team Admin" /> : <Navigate to="/portal" replace />;
  if (phase === 'force-password') {
    return (
      <div style={{ ...shellStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <RifleForcePasswordChange email={admin.email} onDone={verify} />
      </div>
    );
  }
  if (phase === 'error') {
    return <div style={shellStyle}><div style={{ padding: 40, fontFamily: mono, fontSize: 12, color: P.red }}>{errorMsg}</div></div>;
  }

  return (
    <div style={shellStyle}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 100px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.3em', marginBottom: 8 }}>
              TROJAN BATTALION · RIFLE
            </div>
            <h1 style={{ fontFamily: oswald, fontSize: 28, fontWeight: 600, color: P.cream, margin: 0 }}>Team Portal</h1>
            <div style={{ fontFamily: mono, fontSize: 12, color: P.mute, marginTop: 6 }}>Welcome, Makky</div>
          </div>
          <button onClick={signOut} style={{ background: 'transparent', border: `1px solid ${P.hairStrong}`, color: P.mute, fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', padding: '9px 16px', cursor: 'pointer' }}>
            SIGN OUT
          </button>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: `1px solid ${P.hair}` }}>
          {TABS.map((t) => (
            <button
              key={t.id} onClick={() => setTab(t.id)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: mono, fontSize: 12, letterSpacing: '0.1em', fontWeight: 600,
                color: tab === t.id ? P.gold : P.mute, padding: '10px 4px', marginRight: 20,
                borderBottom: tab === t.id ? `2px solid ${P.gold}` : '2px solid transparent',
              }}
            >
              {t.label.toUpperCase()}
            </button>
          ))}
          <button
            onClick={() => setTab('settings')}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: 'auto',
              fontFamily: mono, fontSize: 12, letterSpacing: '0.1em', fontWeight: 600,
              color: tab === 'settings' ? P.gold : P.mute, padding: '10px 4px',
              borderBottom: tab === 'settings' ? `2px solid ${P.gold}` : '2px solid transparent',
            }}
          >
            SETTINGS
          </button>
        </div>

        {tab === 'roster' && <RosterTab />}
        {tab === 'signups' && <SignupsTab />}
        {tab === 'compupload' && <CompUploadTab />}
        {tab === 'scores' && <ScoresTab />}
        {tab === 'calendar' && <CalendarTab />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'history' && <HistoryTab />}
        {tab === 'askai' && <AskAiTab />}
        {tab === 'settings' && (
          <div style={{ maxWidth: 380 }}>
            <RiflePinControl email={admin.email} hasPin={hasPin} onChange={setHasPin} />
          </div>
        )}
      </div>
    </div>
  );
}
