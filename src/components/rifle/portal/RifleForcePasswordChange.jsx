import { useState } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { rifleCompleteFirstLogin } from '../../../lib/rifleAdminApi';
import RiflePinControl from './RiflePinControl';
import { P, mono, oswald } from '../theme';

const MIN_LEN = 8;

// Hard gate shown in place of the portal when rifle_admins.must_change_password
// is true — same shape as review/ForcePasswordChange.jsx, ported for Makaio's
// temp-password first login. The client already holds a valid session (signed
// in with the temp password to get here), so updateUser needs no old password.
export default function RifleForcePasswordChange({ email, onDone }) {
  const [step, setStep] = useState('password');
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

    const { error: completeErr } = await rifleCompleteFirstLogin();
    setBusy(false);
    if (completeErr) {
      setErr(`Password set, but couldn't finish setup: ${completeErr}. Continuing anyway.`);
    }
    setStep('pin');
  }

  const panel = { background: P.navy, border: `1px solid ${P.hairStrong}`, padding: 28, maxWidth: 440 };
  const inputStyle = {
    width: '100%', boxSizing: 'border-box', background: P.deep, border: `1px solid ${P.hair}`,
    color: P.cream, fontFamily: mono, fontSize: 14, padding: '12px 12px', outline: 'none', marginBottom: 16,
  };

  if (step === 'pin') {
    return (
      <div style={panel}>
        <h1 style={{ fontFamily: oswald, fontSize: 20, color: P.cream, margin: '0 0 6px' }}>Password set ✓</h1>
        <p style={{ fontFamily: mono, fontSize: 12, color: P.mute, margin: '0 0 20px' }}>
          One more thing, optional — you can also do this later from settings.
        </p>
        <RiflePinControl email={email} hasPin={false} />
        <button
          onClick={onDone}
          style={{ marginTop: 22, width: '100%', background: P.gold, color: P.ink, border: 'none', fontFamily: mono, fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', padding: '13px' }}
        >
          CONTINUE TO PORTAL →
        </button>
      </div>
    );
  }

  return (
    <div style={panel}>
      <h1 style={{ fontFamily: oswald, fontSize: 20, color: P.cream, margin: '0 0 6px' }}>Set your password</h1>
      <p style={{ fontFamily: mono, fontSize: 12, color: P.mute, margin: '0 0 20px', lineHeight: 1.6 }}>
        This is your first sign-in. Set your own password to continue — the temporary one won&apos;t work again after this.
      </p>
      <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.1em', marginBottom: 6 }}>NEW PASSWORD</div>
      <input type="password" value={pw} autoFocus autoComplete="new-password" onChange={(e) => { setPw(e.target.value); setErr(''); }} style={inputStyle} />
      <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.1em', marginBottom: 6 }}>CONFIRM PASSWORD</div>
      <input
        type="password" value={confirm} autoComplete="new-password"
        onChange={(e) => { setConfirm(e.target.value); setErr(''); }}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        style={inputStyle}
      />
      {err && <div style={{ fontFamily: mono, fontSize: 11, color: P.red, marginBottom: 14 }}>{err}</div>}
      <button
        onClick={submit} disabled={busy}
        style={{ width: '100%', background: P.gold, color: P.ink, border: 'none', fontFamily: mono, fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', padding: '13px', cursor: busy ? 'wait' : 'pointer' }}
      >
        {busy ? 'SETTING…' : 'SET PASSWORD & CONTINUE'}
      </button>
    </div>
  );
}
