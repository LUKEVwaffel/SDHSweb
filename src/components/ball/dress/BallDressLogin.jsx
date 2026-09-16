import { useState, useRef } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import '../../review/review.css';

// Email-only login — no password, no PIN. If the address is an active row in
// the backing table (ball_dress_staff by default; email_reviewers via the
// `fn`/`deniedMessage` props for the Email Review / Ball Ops / Rifle Signups
// reviewer portals — see ReviewPortal.jsx, BallOpsPortal.jsx,
// RifleSignupsPortal.jsx), the edge function named by `fn` mints a session for
// it (role scoping still enforced server-side by is_ball_dress()/
// is_ball_attire()/is_reviewer()). Same email→verifyOtp shape everywhere.
export default function BallDressLogin({
  onSignedIn, notice, heading = 'Dress Approval',
  fn = 'ball-dress-email-login', deniedMessage = "That email isn't set up as an attire approver.",
}) {
  const [email, setEmail] = useState('');
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

  async function attempt() {
    const account = email.trim().toLowerCase();
    if (!account.includes('@')) { setErr('Enter your email.'); return; }
    setBusy(true);
    setErr('');
    const { data, error } = await SB.functions.invoke(fn, {
      body: { email: account },
    });
    if (error || data?.error) {
      setBusy(false);
      fail(deniedMessage);
      return;
    }
    const { error: otpErr } = await SB.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
    setBusy(false);
    if (otpErr) { fail('Sign-in failed.'); return; }
    onSignedIn();
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !busy) attempt();
  }

  return (
    <div className={`rv-panel${shake ? ' rv-shake' : ''}`}>
      <h1 className="rv-h1" style={{ fontSize: 20, marginBottom: 6 }}>Sign in to {heading}</h1>
      <p className="rv-sub" style={{ marginTop: 0, marginBottom: 22, fontSize: 14 }}>{notice || 'Enter the email you were set up with.'}</p>
      <label className="rv-label">Email</label>
      <input
        type="email" value={email} autoFocus autoComplete="username"
        onChange={(e) => { setEmail(e.target.value); setErr(''); }}
        onKeyDown={onKeyDown}
        className="rv-textarea" style={{ marginBottom: 16 }}
      />
      <button className="rv-btn primary" disabled={busy} onClick={attempt} style={{ width: '100%' }}>
        {busy ? 'Signing in…' : 'Continue'}
      </button>
      {err && <div className="rv-flash" style={{ marginTop: 16 }}>{err}</div>}
    </div>
  );
}
