import { useState, useRef } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import '../../review/review.css';

// PIN-only login for the 3 dress verifiers (new population — no password
// account, S-6 provisions the PIN via ball-dress-set-pin). Same
// email+PIN→verifyOtp flow as ReviewLogin's pin mode, just pointed at the
// new ball-dress-pin-login edge fn and with no password fallback mode since
// these accounts never get a password.
export default function BallDressLogin({ onSignedIn, notice, heading = 'Dress Approval' }) {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const shakeTimer = useRef(null);

  function fail(msg) {
    setErr(msg);
    setShake(true);
    clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setShake(false), 420);
  }

  async function attemptPin(value) {
    if (!email.trim()) { setErr('Enter your email first.'); return; }
    setBusy(true);
    setErr('');
    const { data, error } = await SB.functions.invoke('ball-dress-pin-login', {
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
      <h1 className="rv-h1" style={{ fontSize: 20, marginBottom: 6 }}>Sign in to {heading}</h1>
      <p className="rv-sub" style={{ marginTop: 0, marginBottom: 22, fontSize: 14 }}>{notice || 'Enter your email and 4-digit PIN.'}</p>
      <label className="rv-label">Email</label>
      <input
        type="email" value={email} autoFocus autoComplete="username"
        onChange={(e) => { setEmail(e.target.value); setErr(''); }}
        className="rv-textarea" style={{ marginBottom: 16 }}
      />
      <label className="rv-label">4-digit PIN</label>
      <input
        type="password" inputMode="numeric" value={pin}
        onChange={(e) => onPinChange(e.target.value)} disabled={busy}
        className="rv-textarea"
        style={{ marginBottom: 16, letterSpacing: '0.6em', textAlign: 'center', fontSize: 20 }}
      />
      {err && <div className="rv-flash" style={{ marginBottom: 16, marginTop: -4 }}>{err}</div>}
    </div>
  );
}
