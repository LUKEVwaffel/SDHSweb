import { useState, useEffect } from 'react';
import { supabase as SB } from '../../lib/supabaseClient';
import { P, mono, oswald, inter, fs, sp, shadow, ease } from './theme';
import AccountGrid from './login/AccountGrid';
import AccountAuth from './login/AccountAuth';
import PasswordForm from './login/PasswordForm';

// DISPATCH login — account picker. Reads the public login_accounts view (anon)
// to draw the roster, then routes to the per-account auth screen. On any
// successful auth the onAuthStateChange listener in index.jsx flips the app to
// the Dashboard — no onLogin callback needed here.
//
// Stages: 'grid' (pick a face) → 'auth' (authenticate that account) with a
// 'password' escape hatch for first-time / unlisted sign-in.
export default function LoginScreen() {
  const [stage, setStage] = useState('grid');
  const [accounts, setAccounts] = useState(null); // null = loading
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    SB.from('login_accounts').select('*').order('display_name').then(({ data }) => {
      setAccounts(data || []);
    });
  }, []);

  function choose(acct) { setSelected(acct); setStage('auth'); }
  function toGrid() { setSelected(null); setStage('grid'); }

  return (
    <LoginShell>
      {stage === 'grid' && (
        <AccountGrid accounts={accounts} onSelect={choose} onOther={() => setStage('password')} />
      )}
      {stage === 'auth' && selected && <AccountAuth account={selected} onBack={toGrid} />}
      {stage === 'password' && <PasswordForm onBack={toGrid} />}
    </LoginShell>
  );
}

// Shared visual frame — layered navy field, faint gold hatch + vignette,
// DISPATCH lockup with insignia mark.
function LoginShell({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: `
        radial-gradient(900px 500px at 50% -8%, ${P.navyLift} 0%, transparent 62%),
        radial-gradient(1400px 800px at 50% 120%, ${P.navy} 0%, transparent 55%),
        ${P.ink}
      `,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: inter, position: 'relative', overflow: 'hidden', padding: sp[6],
    }}>
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, opacity: 0.035, pointerEvents: 'none',
        backgroundImage: `repeating-linear-gradient(135deg, ${P.gold} 0 2px, transparent 2px 26px)`,
      }} />
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        boxShadow: `inset 0 0 260px 40px rgba(3,8,16,0.75)`,
      }} />
      <div aria-hidden="true" style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2, pointerEvents: 'none',
        background: `linear-gradient(90deg, transparent, ${P.gold}, transparent)`, opacity: 0.5,
      }} />

      <div style={{ width: '100%', maxWidth: 640, position: 'relative', animation: `shellIn 0.5s ${ease} both` }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: sp[8] }}>
          <div aria-hidden="true" style={{
            width: 44, height: 44, marginBottom: sp[3], borderRadius: '50%',
            border: `1px solid ${P.hairStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: P.goldWash, boxShadow: shadow.glow,
          }}>
            <span style={{ fontFamily: oswald, fontWeight: 700, fontSize: fs.md, color: P.gold, letterSpacing: '0.04em' }}>TB</span>
          </div>
          <div style={{ fontFamily: oswald, fontSize: fs.xxl, color: P.cream, letterSpacing: '0.24em', textAlign: 'center', fontWeight: 600 }}>
            DISPATCH
          </div>
          <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.32em', textAlign: 'center', marginTop: 8 }}>
            TROJAN BATTALION &middot; ADMIN
          </div>
        </div>

        {children}

        <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, letterSpacing: '0.2em', textAlign: 'center', marginTop: sp[8] }}>
          S-6 NET CONTROL &middot; AUTHORIZED PERSONNEL ONLY
        </div>
      </div>
      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
        @keyframes shellIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  );
}
