import { useState, useRef, useEffect } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { loginWithPasskey } from '../../../lib/passkey';
import { P, mono, inter, fs, sp, radius, shadow, ease } from '../theme';
import EyeIcon from './EyeIcon';

// Stage 2 — authenticate as the chosen account. Shows only the methods that
// account actually has (passkey / PIN), plus password as a universal fallback.
// On success the session listener in index.jsx takes over; we only surface
// errors here.
export default function AccountAuth({ account, onBack }) {
  const [busy, setBusy] = useState('');       // '' | 'passkey' | 'pin' | 'password'
  const [err, setErr] = useState('');
  const [shake, setShake] = useState(false);
  const [pin, setPin] = useState('');
  // A gated account (forced password change pending) never offers PIN/passkey
  // as a login method — the server rejects both regardless (pin-login /
  // passkey-login check must_change_password after verifying, see
  // admin_password_gate.sql), so don't dangle a button that always 403s.
  // Straight to the password box instead.
  const gated = !!account.must_change_password;
  const [showPw, setShowPw] = useState(gated || (!account.has_passkey && !account.has_pin));
  const [pw, setPw] = useState('');
  const [pwVisible, setPwVisible] = useState(false);
  const pinRef = useRef(null);

  const name = account.display_name || account.email;

  function fail(msg) { setErr(msg); setShake(true); setTimeout(() => setShake(false), 500); }

  async function doPasskey() {
    setErr(''); setBusy('passkey');
    try { await loginWithPasskey(account.email); }
    catch (e) {
      setBusy('');
      if (e.message === 'password_change_required') { setShowPw(true); fail('Password reset required, sign in with your new password.'); return; }
      fail(e.message === 'invalid' ? 'Passkey rejected' : (e.message || 'Touch ID failed'));
    }
  }

  async function submitPin(value) {
    setErr(''); setBusy('pin');
    const { data, error } = await SB.functions.invoke('pin-login', { body: { email: account.email, pin: value } });
    if (error || data?.error) {
      setBusy(''); setPin('');
      if (data?.error === 'password_change_required') { setShowPw(true); fail('Password reset required, sign in with your new password.'); return; }
      if (data?.error === 'locked') fail(`Locked. Too many tries. Try again after ${new Date(data.until).toLocaleTimeString()}.`);
      else fail(typeof data?.remaining === 'number' ? `Wrong PIN, ${data.remaining} left before lockout` : 'Wrong PIN');
      return;
    }
    const { error: otpErr } = await SB.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
    if (otpErr) { setBusy(''); setPin(''); fail('Sign-in failed'); }
    // success → index.jsx flips the app.
  }

  function onPinChange(v) {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
    setErr('');
    if (digits.length === 4 && busy !== 'pin') submitPin(digits);
  }

  async function doPassword() {
    if (busy) return;
    setErr(''); setBusy('password');
    const { error } = await SB.auth.signInWithPassword({ email: account.email, password: pw });
    if (error) { setBusy(''); setPw(''); fail('Access denied'); }
  }

  useEffect(() => { if (account.has_pin && pinRef.current) pinRef.current.focus(); }, [account.has_pin]);

  return (
    <div style={{
      background: P.navy, border: `1px solid ${err ? P.red : P.hairStrong}`,
      borderRadius: radius.md, padding: sp[6], boxShadow: shadow.lg,
      animation: shake ? 'shake 0.4s' : 'none',
    }}>
      {/* who */}
      <div style={{ display: 'flex', alignItems: 'center', gap: sp[3], marginBottom: sp[5] }}>
        <button onClick={onBack} title="Back" style={{ background: 'transparent', border: 'none', color: P.mute, cursor: 'pointer', fontFamily: mono, fontSize: fs.md }}>‹</button>
        {account.photo_url
          ? <img src={account.photo_url} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${P.gold}` }} />
          : <div style={{ width: 48, height: 48, borderRadius: '50%', background: P.deep, border: `1px solid ${P.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: fs.md, color: P.gold }}>{name.charAt(0).toUpperCase()}</div>}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: inter, fontSize: fs.md, color: P.cream }}>{name}</div>
          <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute }}>{account.email}</div>
        </div>
      </div>

      {/* passkey — never offered on a gated account, see `gated` above */}
      {account.has_passkey && !gated && (
        <button onClick={doPasskey} disabled={!!busy} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: sp[2],
          background: P.gold, color: P.ink, border: 'none', borderRadius: radius.sm,
          fontFamily: mono, fontSize: fs.sm, fontWeight: 600, letterSpacing: '0.12em',
          padding: '14px', cursor: busy ? 'wait' : 'pointer', marginBottom: sp[4], opacity: busy && busy !== 'passkey' ? 0.5 : 1,
        }}>☉ {busy === 'passkey' ? 'WAITING FOR TOUCH ID…' : 'SIGN IN WITH TOUCH ID'}</button>
      )}

      {/* pin — never offered on a gated account, see `gated` above */}
      {account.has_pin && !gated && (
        <div style={{ marginBottom: sp[4] }}>
          <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.18em', marginBottom: sp[2] }}>ENTER 4-DIGIT PIN</div>
          <input
            ref={pinRef} type="password" inputMode="numeric" value={pin}
            onChange={(e) => onPinChange(e.target.value)} disabled={busy === 'pin'}
            style={{
              width: '100%', boxSizing: 'border-box', background: P.deep,
              border: `1px solid ${err ? P.red : P.hair}`, color: P.cream,
              fontFamily: mono, fontSize: fs.xl, letterSpacing: '0.6em', textAlign: 'center',
              padding: '14px', borderRadius: radius.sm, outline: 'none',
              boxShadow: 'none',
            }}
          />
        </div>
      )}

      {/* password (always available; auto-shown if no other method) */}
      {showPw ? (
        <div style={{ marginBottom: sp[3] }}>
          <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.18em', marginBottom: sp[2] }}>PASSWORD</div>
          <div style={{ position: 'relative', marginBottom: sp[3] }}>
            <input
              type={pwVisible ? 'text' : 'password'} value={pw} autoFocus={!account.has_pin}
              onChange={(e) => { setPw(e.target.value); setErr(''); }}
              onKeyDown={(e) => e.key === 'Enter' && doPassword()}
              style={{
                width: '100%', boxSizing: 'border-box', background: P.deep,
                border: `1px solid ${err ? P.red : P.hair}`, color: P.cream,
                fontFamily: mono, fontSize: fs.base, padding: '13px 40px 13px 15px', borderRadius: radius.sm,
                outline: 'none', boxShadow: 'none',
              }}
            />
            <button
              type="button" onClick={() => setPwVisible((v) => !v)} title={pwVisible ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', color: P.mute, cursor: 'pointer',
                padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <EyeIcon open={pwVisible} />
            </button>
          </div>
          <button onClick={doPassword} disabled={!!busy} style={{
            width: '100%', background: 'transparent', color: P.gold, border: `1px solid ${P.hairStrong}`,
            borderRadius: radius.sm, fontFamily: mono, fontSize: fs.sm, letterSpacing: '0.12em',
            padding: '13px', cursor: busy ? 'wait' : 'pointer',
          }}>{busy === 'password' ? 'AUTHENTICATING…' : 'SIGN IN'}</button>
        </div>
      ) : (
        <button onClick={() => setShowPw(true)} style={{
          background: 'transparent', border: 'none', color: P.mute, cursor: 'pointer',
          fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.12em', padding: sp[1],
        }}>use password instead</button>
      )}

      {err && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.red, letterSpacing: '0.1em', marginTop: sp[3], transition: `opacity 0.15s ${ease}` }}>{err}</div>}
    </div>
  );
}
