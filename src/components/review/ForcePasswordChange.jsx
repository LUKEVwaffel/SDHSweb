import { useState } from 'react';
import { supabase as SB } from '../../lib/supabaseClient';
import ReviewerPinControl from './ReviewerPinControl';

const MIN_LEN = 8;

// Hard gate shown in place of the portal when email_reviewers.must_change_password
// is true — a reviewer on their dashboard-created temp password cannot see
// pending/sent/history until they set their own password. The client already
// holds a valid session (they signed in with the temp password to get here),
// so supabase.auth.updateUser({ password }) needs no re-entry of the old one.
// After the password lands, complete-first-login (self-only, service-role
// write) clears the flag server-side — the client never gets an UPDATE grant
// on email_reviewers. A one-time optional PIN offer follows before handing
// off to the portal; skippable, and reachable again later from settings.
export default function ForcePasswordChange({ email, onDone }) {
  const [step, setStep] = useState('password'); // password | pin
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    if (pw.length < MIN_LEN) { setErr(`Password must be at least ${MIN_LEN} characters.`); return; }
    if (pw !== confirm) { setErr('Passwords do not match.'); return; }

    setBusy(true);
    const { error: updateErr } = await SB.auth.updateUser({ password: pw });
    if (updateErr) {
      setBusy(false);
      setErr(`Could not set password: ${updateErr.message}`);
      return;
    }

    const { data, error: completeErr } = await SB.functions.invoke('complete-first-login', { body: {} });
    setBusy(false);
    if (completeErr || data?.error) {
      // Password DID change — this is a best-effort flag clear, not the gate
      // itself. Surface it but don't trap the reviewer behind a password that
      // already succeeded.
      setErr(`Password set, but couldn't finish setup: ${data?.error || completeErr.message}. Continuing anyway.`);
    }
    setStep('pin');
  }

  if (step === 'pin') {
    return (
      <div className="rv-panel">
        <h1 className="rv-h1" style={{ fontSize: 20, marginBottom: 6 }}>Password set ✓</h1>
        <p className="rv-sub" style={{ marginTop: 0, marginBottom: 20, fontSize: 14 }}>
          One more thing — optional, you can also do this later from settings.
        </p>
        <ReviewerPinControl email={email} hasPin={false} />
        <button className="rv-btn primary" onClick={onDone} style={{ marginTop: 20 }}>
          Continue to portal
        </button>
      </div>
    );
  }

  return (
    <div className="rv-panel">
      <h1 className="rv-h1" style={{ fontSize: 20, marginBottom: 6 }}>Set your password</h1>
      <p className="rv-sub" style={{ marginTop: 0, marginBottom: 22, fontSize: 14 }}>
        This is your first sign-in. Set your own password to continue — the temporary one won't work again after this.
      </p>
      <label className="rv-label">New password</label>
      <input
        type="password" value={pw} autoFocus autoComplete="new-password"
        onChange={(e) => { setPw(e.target.value); setErr(''); }}
        className="rv-textarea" style={{ marginBottom: 16 }}
      />
      <label className="rv-label">Confirm password</label>
      <input
        type="password" value={confirm} autoComplete="new-password"
        onChange={(e) => { setConfirm(e.target.value); setErr(''); }}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        className="rv-textarea" style={{ marginBottom: 16 }}
      />
      {err && <div className="rv-flash" style={{ marginBottom: 16, marginTop: -4 }}>{err}</div>}
      <button className="rv-btn primary" onClick={submit} disabled={busy}>
        {busy ? 'Setting…' : 'Set password & continue'}
      </button>
    </div>
  );
}
