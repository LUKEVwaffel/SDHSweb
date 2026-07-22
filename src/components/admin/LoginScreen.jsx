import { useState, useEffect } from 'react';
import { supabase as SB } from '../../lib/supabaseClient';
import { P, mono, oswald, inter, fs, sp } from './theme';
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

// Shared visual frame — radial navy field, faint gold hatch, DISPATCH lockup.
function LoginShell({ children }) {
  return (
    <div style={{
      minHeight: '100vh', background: `radial-gradient(1200px 600px at 50% -10%, ${P.navy} 0%, ${P.ink} 60%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: inter, position: 'relative', overflow: 'hidden', padding: sp[6],
    }}>
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, opacity: 0.04, pointerEvents: 'none',
        backgroundImage: `repeating-linear-gradient(135deg, ${P.gold} 0 2px, transparent 2px 24px)`,
      }} />
      <div style={{ width: '100%', maxWidth: 600, position: 'relative' }}>
        <div style={{ fontFamily: oswald, fontSize: fs.xxl, color: P.cream, letterSpacing: '0.22em', textAlign: 'center', marginBottom: 6, fontWeight: 600 }}>
          DISPATCH
        </div>
        <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.3em', textAlign: 'center', marginBottom: sp[8] }}>
          TROJAN BATTALION · ADMIN
        </div>
        {children}
        <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, letterSpacing: '0.2em', textAlign: 'center', marginTop: sp[6] }}>
          S-6 NET CONTROL · AUTHORIZED PERSONNEL ONLY
        </div>
      </div>
      <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }`}</style>
    </div>
  );
}
