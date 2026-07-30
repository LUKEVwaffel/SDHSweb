import { useState } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, fs, sp, radius, shadow, focusRing, ease } from '../theme';
import EyeIcon from './EyeIcon';

// "Other account" fallback — the classic email + password sign-in, for accounts
// not on the picker or a first-time login. Same signInWithPassword path the old
// LoginScreen used; the session listener in index.jsx handles success.
export default function PasswordForm({ onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(null);
  const [showPw, setShowPw] = useState(false);

  async function attempt() {
    if (busy) return;
    if (!email.trim() || !password) { fail('Enter email and password'); return; }
    setBusy(true); setErr('');
    const { error } = await SB.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { fail('ACCESS DENIED'); setPassword(''); }
  }
  function fail(msg) { setErr(msg); setShake(true); setTimeout(() => setShake(false), 500); }

  const inputStyle = (key) => ({
    width: '100%', background: P.deep,
    border: `1px solid ${err ? P.red : (focused === key ? P.gold : P.hair)}`,
    color: P.cream, fontFamily: mono, fontSize: fs.base, padding: '13px 15px',
    outline: 'none', boxSizing: 'border-box', marginBottom: sp[4], borderRadius: radius.sm,
    boxShadow: focused === key && !err ? focusRing : 'none',
    transition: `border-color 0.15s ${ease}, box-shadow 0.15s ${ease}`,
  });

  return (
    <div style={{
      background: P.navy, border: `1px solid ${err ? P.red : P.hairStrong}`,
      padding: sp[6], borderRadius: radius.md, boxShadow: shadow.lg,
      animation: shake ? 'shake 0.4s' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: sp[2], marginBottom: sp[4] }}>
        <button onClick={onBack} title="Back" style={{ background: 'transparent', border: 'none', color: P.mute, cursor: 'pointer', fontFamily: mono, fontSize: fs.md }}>‹</button>
        <span style={{ fontFamily: mono, fontSize: fs.tiny, color: P.gold, letterSpacing: '0.18em' }}>SIGN IN WITH EMAIL</span>
      </div>
      <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.18em', marginBottom: sp[2] }}>EMAIL</div>
      <input
        type="email" value={email} autoFocus autoComplete="username"
        onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
        onChange={(e) => { setEmail(e.target.value); setErr(''); }}
        onKeyDown={(e) => e.key === 'Enter' && attempt()}
        style={inputStyle('email')}
      />
      <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.18em', marginBottom: sp[2] }}>PASSWORD</div>
      <div style={{ position: 'relative', marginBottom: sp[4] }}>
        <input
          type={showPw ? 'text' : 'password'} value={password} autoComplete="current-password"
          onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
          onChange={(e) => { setPassword(e.target.value); setErr(''); }}
          onKeyDown={(e) => e.key === 'Enter' && attempt()}
          style={{ ...inputStyle('password'), marginBottom: 0, paddingRight: 40 }}
        />
        <button
          type="button" onClick={() => setShowPw((v) => !v)} title={showPw ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'transparent', border: 'none', color: P.mute, cursor: 'pointer',
            padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <EyeIcon open={showPw} />
        </button>
      </div>
      {err && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.red, letterSpacing: '0.12em', marginBottom: sp[3] }}>{err}</div>}
      <button onClick={attempt} disabled={busy} style={{
        width: '100%', background: P.gold, color: P.ink, border: 'none', borderRadius: radius.sm,
        fontFamily: mono, fontSize: fs.sm, fontWeight: 600, letterSpacing: '0.14em',
        padding: '14px', cursor: busy ? 'wait' : 'pointer',
      }}>{busy ? 'AUTHENTICATING…' : 'AUTHENTICATE'}</button>
    </div>
  );
}
