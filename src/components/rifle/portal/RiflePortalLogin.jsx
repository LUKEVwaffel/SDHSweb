import { useState, useRef, useEffect } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, oswald } from '../theme';

// Single-account sign-in for Makaio's portal — no account grid (that's the
// DISPATCH picker's job), just email+password with PIN as a faster repeat
// path once he's set one. Mirrors AccountAuth.jsx's PIN/password logic
// against rifle-pin-login instead of pin-login.
export default function RiflePortalLogin() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pin, setPin] = useState('');
  const [usePin, setUsePin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [shake, setShake] = useState(false);
  const pinRef = useRef(null);

  function fail(msg) { setErr(msg); setShake(true); setTimeout(() => setShake(false), 500); }

  useEffect(() => { if (usePin && pinRef.current) pinRef.current.focus(); }, [usePin]);

  async function submitPassword() {
    if (busy) return;
    if (!email.trim() || !pw) { fail('Enter email and password'); return; }
    setBusy(true); setErr('');
    const { error } = await SB.auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) { fail('Access denied'); setPw(''); }
  }

  async function submitPin(value) {
    if (!email.trim()) { fail('Enter your email first'); return; }
    setErr(''); setBusy(true);
    const { data, error } = await SB.functions.invoke('rifle-pin-login', { body: { email: email.trim(), pin: value } });
    if (error || data?.error) {
      setBusy(false); setPin('');
      if (data?.error === 'password_change_required') { setUsePin(false); fail('Password reset required — sign in with your password.'); return; }
      if (data?.error === 'locked') { fail(`Locked. Try again after ${new Date(data.until).toLocaleTimeString()}.`); return; }
      fail(typeof data?.remaining === 'number' ? `Wrong PIN, ${data.remaining} left before lockout` : 'Wrong PIN');
      return;
    }
    const { error: otpErr } = await SB.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
    setBusy(false);
    if (otpErr) { setPin(''); fail('Sign-in failed'); }
  }

  function onPinChange(v) {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
    setErr('');
    if (digits.length === 4 && !busy) submitPin(digits);
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', background: P.deep, border: `1px solid ${err ? P.red : P.hair}`,
    color: P.cream, fontFamily: mono, fontSize: 14, padding: '12px 12px', outline: 'none', marginBottom: 16,
  };

  return (
    <div style={{ background: P.ink, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', padding: 24 }}>
      <style>{`@keyframes rifle-shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }`}</style>
      <div style={{
        width: '100%', maxWidth: 400, background: P.navy, border: `1px solid ${err ? P.red : P.hairStrong}`,
        padding: 32, animation: shake ? 'rifle-shake 0.4s' : 'none',
      }}>
        <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.3em', marginBottom: 8 }}>
          TROJAN BATTALION · RIFLE
        </div>
        <h1 style={{ fontFamily: oswald, fontSize: 24, fontWeight: 600, color: P.cream, margin: '0 0 22px' }}>
          Team Portal
        </h1>

        <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.1em', marginBottom: 6 }}>SCHOOL EMAIL</div>
        <input
          type="email" value={email} autoFocus autoComplete="username"
          onChange={(e) => { setEmail(e.target.value); setErr(''); }}
          onKeyDown={(e) => e.key === 'Enter' && !usePin && submitPassword()}
          style={inputStyle}
        />

        {usePin ? (
          <>
            <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.1em', marginBottom: 6 }}>4-DIGIT PIN</div>
            <input
              ref={pinRef} type="password" inputMode="numeric" value={pin} disabled={busy}
              onChange={(e) => onPinChange(e.target.value)}
              style={{ ...inputStyle, fontSize: 22, letterSpacing: '0.6em', textAlign: 'center' }}
            />
          </>
        ) : (
          <>
            <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.1em', marginBottom: 6 }}>PASSWORD</div>
            <input
              type="password" value={pw} autoComplete="current-password"
              onChange={(e) => { setPw(e.target.value); setErr(''); }}
              onKeyDown={(e) => e.key === 'Enter' && submitPassword()}
              style={inputStyle}
            />
          </>
        )}

        {err && <div style={{ fontFamily: mono, fontSize: 11, color: P.red, marginBottom: 14 }}>{err}</div>}

        {!usePin && (
          <button
            onClick={submitPassword} disabled={busy}
            style={{ width: '100%', background: P.gold, color: P.ink, border: 'none', fontFamily: mono, fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', padding: '13px', cursor: busy ? 'wait' : 'pointer', marginBottom: 12 }}
          >
            {busy ? 'AUTHENTICATING…' : 'SIGN IN'}
          </button>
        )}

        <button
          onClick={() => { setUsePin((v) => !v); setErr(''); setPw(''); setPin(''); }}
          style={{ width: '100%', background: 'transparent', border: 'none', color: P.mute, cursor: 'pointer', fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', padding: 6 }}
        >
          {usePin ? 'use password instead' : 'use PIN instead'}
        </button>
      </div>
    </div>
  );
}
