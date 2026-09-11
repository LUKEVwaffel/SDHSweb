import { useState, useEffect } from 'react';
import { supabase as SB } from '../../lib/supabaseClient';

// Palette — matches the DISPATCH admin theme (navy / gold / cream, sharp edges).
const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.58)', hair: 'rgba(201,169,97,0.22)',
  red: '#C0392B',
};
const mono = "'JetBrains Mono', monospace";
const inter = 'Inter, sans-serif';

const centered = {
  minHeight: '100vh', background: P.ink, display: 'flex',
  alignItems: 'center', justifyContent: 'center', padding: 24,
};
const statusText = { fontFamily: mono, fontSize: 10, letterSpacing: '0.3em', color: P.mute };

/**
 * Auth wrapper for the two Luke-only surfaces (/lukeupload, /lukepwa). Reuses
 * the existing DISPATCH Supabase Auth pool — no new auth. Access = a live
 * session whose email has a row in admin_roles (any role). If admin_roles
 * cannot be read (pre-RBAC / transient error) it falls back to allow, exactly
 * like src/components/admin/index.jsx.
 *
 * @param {string} label   short surface name shown on the sign-in card
 * @param {React.ReactNode} children  rendered once authorized; receives no props
 */
export default function AdminGate({ label, children }) {
  const [session, setSession] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | anon | checking | ok | denied

  useEffect(() => {
    SB.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setPhase(data.session ? 'checking' : 'anon');
    });
    const { data: sub } = SB.auth.onAuthStateChange((_e, next) => {
      setSession(next);
      setPhase(next ? 'checking' : 'anon');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (phase !== 'checking' || !session) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await SB.from('admin_roles')
        .select('role').eq('email', session.user.email).maybeSingle();
      if (cancelled) return;
      // error => table/policy issue => allow (pre-RBAC parity).
      // no row => a signed-in non-admin (e.g. an email reviewer) => deny.
      setPhase(error ? 'ok' : (data?.role ? 'ok' : 'denied'));
    })();
    return () => { cancelled = true; };
  }, [phase, session]);

  if (phase === 'loading' || phase === 'checking') {
    return <div style={centered}><div style={statusText}>AUTHENTICATING…</div></div>;
  }

  if (phase === 'denied') {
    return (
      <div style={{ ...centered, flexDirection: 'column', gap: 16, textAlign: 'center' }}>
        <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.28em' }}>
          ACCESS NOT AUTHORIZED
        </div>
        <div style={{ fontFamily: inter, fontSize: 14, color: P.mute, maxWidth: 360, lineHeight: 1.6 }}>
          {session?.user?.email} has no DISPATCH role.
        </div>
        <button onClick={() => SB.auth.signOut()} style={ghostBtn}>SIGN OUT</button>
      </div>
    );
  }

  if (phase === 'anon') return <SignIn label={label} />;

  return children;
}

function SignIn({ label }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await SB.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr(error.message || 'Sign-in failed.');
    // success => onAuthStateChange in AdminGate takes over.
  }

  return (
    <div style={centered}>
      <form onSubmit={submit} style={{
        width: '100%', maxWidth: 340, background: P.navy, border: `1px solid ${P.hair}`,
        padding: 28, fontFamily: inter,
      }}>
        <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.28em', color: P.gold, marginBottom: 4 }}>
          DISPATCH · OPTIC
        </div>
        <div style={{ fontFamily: mono, fontSize: 13, letterSpacing: '0.16em', color: P.cream, marginBottom: 20 }}>
          {label}
        </div>
        <input type="email" required placeholder="admin email" autoComplete="username"
          value={email} onChange={(e) => setEmail(e.target.value)} style={field} />
        <input type="password" required placeholder="password" autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...field, marginTop: 10 }} />
        {err && <div style={{ fontFamily: mono, fontSize: 10, color: P.red, marginTop: 10 }}>{err}</div>}
        <button type="submit" disabled={busy} style={{ ...goldBtn, width: '100%', marginTop: 16, opacity: busy ? 0.5 : 1 }}>
          {busy ? 'SIGNING IN…' : 'SIGN IN'}
        </button>
      </form>
    </div>
  );
}

const field = {
  width: '100%', boxSizing: 'border-box', background: P.deep, border: `1px solid ${P.hair}`,
  color: P.cream, fontFamily: inter, fontSize: 14, padding: '11px 12px', outline: 'none',
};
const goldBtn = {
  background: P.gold, color: P.ink, border: 'none', cursor: 'pointer',
  fontFamily: mono, fontSize: 11, letterSpacing: '0.16em', fontWeight: 600, padding: '12px 18px',
};
const ghostBtn = {
  background: 'transparent', border: `1px solid ${P.gold}`, color: P.gold,
  fontFamily: mono, fontSize: 10, letterSpacing: '0.16em', padding: '10px 18px', cursor: 'pointer',
};

export { P as GATE_P, mono as GATE_MONO, inter as GATE_INTER };
