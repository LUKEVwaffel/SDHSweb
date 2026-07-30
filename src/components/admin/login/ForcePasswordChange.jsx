import { useState } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, oswald, inter, fs, sp, radius, shadow } from '../theme';
import SelfCredentialControls from '../panels/advanced/SelfCredentialControls';

const MIN_LEN = 8;

// Hard gate shown in place of the Dashboard when admin_roles.must_change_password
// is true — an admin on a dashboard-set temp password cannot see anything else
// until they set their own password. Direct DISPATCH-themed port of
// src/components/review/ForcePasswordChange.jsx (the reviewer version); see
// admin_password_gate.sql for the server-side half of this feature.
//
// The client already holds a valid session (they signed in with the temp
// password to get here), so supabase.auth.updateUser({ password }) needs no
// re-entry of the old one. After the password lands,
// complete-admin-first-login (self-only, service-role write) clears the flag
// server-side — the client never gets an UPDATE grant on admin_roles. A
// one-time optional PIN/passkey offer follows before handing off to the
// Dashboard; skippable, reachable again later from Accounts / self settings.
export default function ForcePasswordChange({ email, onDone }) {
  const [step, setStep] = useState('password'); // password | credentials
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

    const { data, error: completeErr } = await SB.functions.invoke('complete-admin-first-login', { body: {} });
    setBusy(false);
    if (completeErr || data?.error) {
      // Password DID change — this is a best-effort flag clear, not the gate
      // itself. Surface it but don't trap the admin behind a password that
      // already succeeded.
      setErr(`Password set, but couldn't finish setup: ${data?.error || completeErr.message}. Continuing anyway.`);
    }
    setStep('credentials');
  }

  const panelStyle = {
    background: P.navy, border: `1px solid ${err ? P.red : P.hairStrong}`,
    borderRadius: radius.md, padding: sp[6], boxShadow: shadow.lg,
  };

  if (step === 'credentials') {
    return (
      <Shell email={email}>
        <div style={panelStyle}>
          <div style={{ fontFamily: inter, fontSize: fs.md, color: P.cream, marginBottom: 6 }}>Password set ✓</div>
          <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, marginBottom: sp[5], lineHeight: 1.6 }}>
            Optional — set a PIN or Touch ID for faster sign-in next time. You can also do this later from Accounts.
          </div>
          <SelfCredentialControls email={email} hasPin={false} hasPasskey={false} />
          <button onClick={onDone} style={{
            width: '100%', background: P.gold, color: P.ink, border: 'none', borderRadius: radius.sm,
            fontFamily: mono, fontSize: fs.sm, fontWeight: 600, letterSpacing: '0.14em',
            padding: '14px', cursor: 'pointer', marginTop: sp[4],
          }}>CONTINUE TO DASHBOARD</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell email={email}>
      <div style={panelStyle}>
        <div style={{ fontFamily: inter, fontSize: fs.md, color: P.cream, marginBottom: 6 }}>Set your password</div>
        <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, marginBottom: sp[5], lineHeight: 1.6 }}>
          This is your first sign-in. Set your own password to continue — the temporary one won't work again after this.
        </div>

        <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.18em', marginBottom: sp[2] }}>NEW PASSWORD</div>
        <input
          type="password" value={pw} autoFocus autoComplete="new-password"
          onChange={(e) => { setPw(e.target.value); setErr(''); }}
          style={inputStyle(err)}
        />
        <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.18em', marginBottom: sp[2] }}>CONFIRM PASSWORD</div>
        <input
          type="password" value={confirm} autoComplete="new-password"
          onChange={(e) => { setConfirm(e.target.value); setErr(''); }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={{ ...inputStyle(err), marginBottom: sp[4] }}
        />

        {err && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.red, letterSpacing: '0.05em', marginBottom: sp[3] }}>{err}</div>}

        <button onClick={submit} disabled={busy} style={{
          width: '100%', background: P.gold, color: P.ink, border: 'none', borderRadius: radius.sm,
          fontFamily: mono, fontSize: fs.sm, fontWeight: 600, letterSpacing: '0.14em',
          padding: '14px', cursor: busy ? 'wait' : 'pointer',
        }}>{busy ? 'SETTING…' : 'SET PASSWORD & CONTINUE'}</button>
      </div>
    </Shell>
  );
}

function inputStyle(err) {
  return {
    width: '100%', boxSizing: 'border-box', background: P.deep,
    border: `1px solid ${err ? P.red : P.hair}`, color: P.cream,
    fontFamily: mono, fontSize: fs.base, padding: '13px 15px', borderRadius: radius.sm,
    outline: 'none', marginBottom: sp[4],
  };
}

// Matches LoginScreen's LoginShell chrome so the gate reads as part of the
// same sign-in sequence, not a jarring different screen.
function Shell({ email, children }) {
  return (
    <div style={{
      minHeight: '100vh', background: `radial-gradient(1200px 600px at 50% -10%, ${P.navy} 0%, ${P.ink} 60%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: inter, padding: sp[6],
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ fontFamily: oswald, fontSize: fs.xxl, color: P.cream, letterSpacing: '0.22em', textAlign: 'center', marginBottom: 6, fontWeight: 600 }}>
          DISPATCH
        </div>
        <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.3em', textAlign: 'center', marginBottom: sp[3] }}>
          FIRST SIGN-IN &middot; PASSWORD REQUIRED
        </div>
        <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, letterSpacing: '0.05em', textAlign: 'center', marginBottom: sp[8] }}>
          Signed in as <span style={{ color: P.cream }}>{email}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
