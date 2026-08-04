import { useState, useRef } from 'react';
import { supabase as SB } from '../../lib/supabaseClient';
import './review.css';

// Email+password (default) or email+PIN gate for the 3 reviewers (Chief/SAI,
// Sgt Kaz, 1SGT). No pre-auth "which method does this account have" lookup —
// unlike the DISPATCH admin picker's login_accounts view, this form doesn't
// know anything about the account until the reviewer picks a mode themselves,
// so there's no per-account enumeration surface here.
export default function ReviewLogin({ onSignedIn, notice }) {
  const [mode, setMode] = useState('password'); // password | pin
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const shakeTimer = useRef(null);
  const pinRef = useRef(null);

  function fail(msg) {
    setErr(msg);
    setShake(true);
    clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setShake(false), 420);
  }

  async function attemptPassword() {
    if (busy) return;
    if (!email.trim() || !password) { setErr('Enter email and password.'); return; }
    setBusy(true);
    setErr('');
    const { error } = await SB.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setPassword('');
      fail('Incorrect email or password.');
      return;
    }
    onSignedIn();
  }

  async function attemptPin(value) {
    if (!email.trim()) { setErr('Enter your email first.'); return; }
    setBusy(true);
    setErr('');
    const { data, error } = await SB.functions.invoke('reviewer-pin-login', {
      body: { email: email.trim(), pin: value },
    });
    if (error || data?.error) {
      setBusy(false);
      setPin('');
      if (data?.error === 'locked') fail(`Locked. Too many tries. Try again after ${new Date(data.until).toLocaleTimeString()}.`);
      else fail(typeof data?.remaining === 'number' ? `Wrong PIN, ${data.remaining} left before lockout.` : 'Incorrect email or PIN.');
      return;
    }
    const { error: otpErr } = await SB.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
    setBusy(false);
    if (otpErr) { setPin(''); fail('Sign-in failed.'); return; }
    onSignedIn();
  }

  function onPinChange(v) {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
    setErr('');
    if (digits.length === 4 && !busy) attemptPin(digits);
  }

  return (
    <div className={`rv-panel${shake ? ' rv-shake' : ''}`}>
      <h1 className="rv-h1" style={{ fontSize: 20, marginBottom: 6 }}>Sign in to review</h1>
      <p className="rv-sub" style={{ marginTop: 0, marginBottom: 22, fontSize: 14 }}>
        {notice || (mode === 'pin' ? 'Enter your email and 4-digit PIN.' : 'Enter the email and password for your reviewer account.')}
      </p>
      <label className="rv-label">Email</label>
      <input
        type="email" value={email} autoFocus autoComplete="username"
        onChange={(e) => { setEmail(e.target.value); setErr(''); }}
        onKeyDown={(e) => e.key === 'Enter' && mode === 'password' && attemptPassword()}
        className="rv-textarea" style={{ marginBottom: 16 }}
      />

      {mode === 'password' ? (
        <>
          <label className="rv-label">Password</label>
          <input
            type="password" value={password} autoComplete="current-password"
            onChange={(e) => { setPassword(e.target.value); setErr(''); }}
            onKeyDown={(e) => e.key === 'Enter' && attemptPassword()}
            className="rv-textarea" style={{ marginBottom: 16 }}
          />
          {err && <div className="rv-flash" style={{ marginBottom: 16, marginTop: -4 }}>{err}</div>}
          <button className="rv-btn primary" onClick={attemptPassword} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <button
            className="rv-link" style={{ marginTop: 14 }}
            onClick={() => { setMode('pin'); setErr(''); setPassword(''); }}
          >
            Use PIN instead
          </button>
        </>
      ) : (
        <>
          <label className="rv-label">4-digit PIN</label>
          <input
            ref={pinRef} type="password" inputMode="numeric" value={pin}
            onChange={(e) => onPinChange(e.target.value)} disabled={busy}
            className="rv-textarea"
            style={{ marginBottom: 16, letterSpacing: '0.6em', textAlign: 'center', fontSize: 20 }}
          />
          {err && <div className="rv-flash" style={{ marginBottom: 16, marginTop: -4 }}>{err}</div>}
          <button
            className="rv-link"
            onClick={() => { setMode('password'); setErr(''); setPin(''); }}
          >
            Use password instead
          </button>
        </>
      )}
    </div>
  );
}
