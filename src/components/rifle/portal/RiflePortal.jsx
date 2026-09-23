import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import DashboardTab from './DashboardTab';
import ShooterTab from './ShooterTab';
import LineupTab from './LineupTab';
import { P, mono, oswald } from '../theme';
import { seasonOf } from './rifleStats';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'scores', label: 'Scores' },
  { id: 'shooters', label: 'Shooters' },
  { id: 'lineup', label: 'Lineup' },
  { id: 'roster', label: 'Roster' },
  { id: 'signups', label: 'Signups' },
  { id: 'compupload', label: 'Comp Upload' },
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
  const [admin, setAdmin] = useState(null); // { email, must_change_password, display_name }
  const [hasPin, setHasPin] = useState(false);
  const [tab, setTab] = useState('dashboard');
  const [tabExtra, setTabExtra] = useState(null); // e.g. { profileId } for the Shooters tab, { matchId } for Scores
  const [errorMsg, setErrorMsg] = useState('');
  const [badge, setBadge] = useState(null); // { season, week, weeks }
  const [searchIndex, setSearchIndex] = useState({ shooters: [], matches: [] });
  const [q, setQ] = useState('');
  const searchRef = useRef(null);

  const goTab = useCallback((id, extra) => {
    setTab(id);
    setTabExtra(extra || null);
    setQ('');
  }, []);

  const loadShell = useCallback(async () => {
    const [{ data: shooters }, { data: matches }, { data: scoreRows }] = await Promise.all([
      SB.from('rifle_shooters').select('id, name, active').order('name'),
      SB.from('rifle_matches').select('id, week, dates, opponent').order('week', { ascending: false }),
      SB.from('rifle_scores').select('match_id'),
    ]);
    setSearchIndex({
      shooters: (shooters || []).map((s) => ({ id: s.id, name: s.name, active: s.active })),
      matches: (matches || []).map((m) => ({ id: m.id, week: m.week, opponent: m.opponent })),
    });
    const scoredIds = new Set((scoreRows || []).map((r) => r.match_id));
    const scoredMatches = (matches || []).filter((m) => scoredIds.has(m.id));
    const mostRecent = scoredMatches[0]; // matches already ordered week desc
    setBadge({
      season: mostRecent ? seasonOf(mostRecent) : (matches?.[0] ? seasonOf(matches[0]) : '—'),
      week: mostRecent?.week ?? 0,
      weeks: matches?.length ?? 0,
    });
  }, []);

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

  useEffect(() => {
    if (phase === 'ready') loadShell();
  }, [phase, loadShell]);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') setQ('');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function signOut() {
    await SB.auth.signOut();
    setAdmin(null);
    setPhase('login');
  }

  const results = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return [];
    const shooterHits = searchIndex.shooters
      .filter((s) => s.name.toLowerCase().includes(ql))
      .slice(0, 4)
      .map((s) => ({ key: `s${s.id}`, label: s.name, kind: 'SHOOTER', go: () => goTab('shooters', { profileId: s.id }) }));
    const matchHits = searchIndex.matches
      .filter((m) => `week ${m.week} ${m.opponent || ''}`.toLowerCase().includes(ql))
      .slice(0, 4)
      .map((m) => ({ key: `m${m.id}`, label: `Week ${m.week}${m.opponent ? ` · ${m.opponent}` : ''}`, kind: 'MATCH', go: () => goTab('scores', { matchId: m.id }) }));
    return [...shooterHits, ...matchHits].slice(0, 6);
  }, [q, searchIndex, goTab]);

  const shellStyle = {
    background: P.ink, minHeight: '100vh', fontFamily: 'Inter, sans-serif',
    backgroundImage: 'linear-gradient(rgba(201,169,97,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(201,169,97,0.035) 1px,transparent 1px)',
    backgroundSize: '48px 48px',
  };

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

  const initials = (admin.display_name || admin.email || '??').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <div style={shellStyle}>
      <div style={{ borderBottom: `1px solid ${P.hair}`, background: 'rgba(6,16,31,0.92)', position: 'sticky', top: 0, zIndex: 20, backdropFilter: 'blur(6px)' }}>
        <div style={{ maxWidth: 1600, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 24, height: 62, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 28, height: 28, border: `1px solid ${P.gold}`, borderRadius: '50%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: P.gold }} />
            </div>
            <div>
              <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.3em' }}>TROJAN BATTALION · RIFLE</div>
              <div style={{ fontFamily: oswald, fontSize: 17, fontWeight: 600, color: P.cream, lineHeight: 1.1 }}>RANGE OPS</div>
            </div>
          </div>

          {badge && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: mono, fontSize: 10, letterSpacing: '0.12em', color: P.mute, borderLeft: `1px solid ${P.hair}`, paddingLeft: 20, whiteSpace: 'nowrap' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: P.win, boxShadow: `0 0 8px ${P.win}` }} />
              <span>SEASON {badge.season} · WK {badge.week} OF {badge.weeks}</span>
            </div>
          )}

          <div style={{ position: 'relative', flex: 1, maxWidth: 280, minWidth: 160 }}>
            <input
              ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Jump to shooter or match…"
              style={{ width: '100%', boxSizing: 'border-box', background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 12, padding: '8px 44px 8px 10px', outline: 'none' }}
            />
            <div style={{ position: 'absolute', right: 7, top: 6, fontFamily: mono, fontSize: 9, color: P.faint, border: `1px solid ${P.hair}`, padding: '1px 5px' }}>⌘K</div>
            {results.length > 0 && (
              <div style={{ position: 'absolute', top: 36, left: 0, right: 0, background: P.deep, border: `1px solid ${P.hairStrong}`, boxShadow: '0 20px 40px rgba(0,0,0,0.5)', zIndex: 30 }}>
                {results.map((r) => (
                  <div key={r.key} onClick={r.go} style={{ padding: '9px 11px', display: 'flex', justifyContent: 'space-between', gap: 10, cursor: 'pointer', borderBottom: `1px solid ${P.hair}`, fontFamily: mono, fontSize: 12 }}>
                    <span style={{ color: P.cream }}>{r.label}</span>
                    <span style={{ color: P.faint, fontSize: 10, letterSpacing: '0.1em' }}>{r.kind}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderLeft: `1px solid ${P.hair}`, paddingLeft: 18, marginLeft: 'auto' }}>
            <div style={{ width: 30, height: 30, background: P.navy, border: `1px solid ${P.hairStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: oswald, fontSize: 12, color: P.bright }}>{initials}</div>
            <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, letterSpacing: '0.06em', lineHeight: 1.4 }}>
              {admin.display_name || admin.email}<br /><span style={{ color: P.faint }}>TEAM ADMIN</span>
            </div>
            <button onClick={signOut} style={{ background: 'transparent', border: `1px solid ${P.hairStrong}`, color: P.mute, fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', padding: '8px 12px', cursor: 'pointer' }}>
              SIGN OUT
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 1600, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 0, overflowX: 'auto' }}>
          {TABS.map((t) => (
            <button
              key={t.id} onClick={() => goTab(t.id)}
              style={{
                background: tab === t.id ? 'rgba(201,169,97,0.08)' : 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', fontWeight: 600, whiteSpace: 'nowrap',
                color: tab === t.id ? P.bright : P.mute, padding: '10px 11px',
                borderBottom: tab === t.id ? `2px solid ${P.gold}` : '2px solid transparent',
              }}
              onMouseEnter={(e) => { if (tab !== t.id) e.currentTarget.style.color = P.cream; }}
              onMouseLeave={(e) => { if (tab !== t.id) e.currentTarget.style.color = P.mute; }}
            >
              {t.label.toUpperCase()}
            </button>
          ))}
          <button
            onClick={() => goTab('settings')}
            style={{
              background: tab === 'settings' ? 'rgba(201,169,97,0.08)' : 'transparent', border: 'none', cursor: 'pointer', marginLeft: 'auto',
              fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', fontWeight: 600, whiteSpace: 'nowrap',
              color: tab === 'settings' ? P.bright : P.mute, padding: '10px 11px',
              borderBottom: tab === 'settings' ? `2px solid ${P.gold}` : '2px solid transparent',
            }}
          >
            SETTINGS
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1600, margin: '0 auto', padding: '26px 24px 100px' }}>
        {tab === 'dashboard' && <DashboardTab onNavigate={goTab} />}
        {tab === 'scores' && <ScoresTab initialMatchId={tabExtra?.matchId} />}
        {tab === 'shooters' && <ShooterTab initialProfileId={tabExtra?.profileId} onNavigate={goTab} />}
        {tab === 'lineup' && <LineupTab onNavigate={goTab} />}
        {tab === 'roster' && <RosterTab />}
        {tab === 'signups' && <SignupsTab />}
        {tab === 'compupload' && <CompUploadTab />}
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
