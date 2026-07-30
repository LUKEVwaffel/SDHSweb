import { useState } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { registerPasskey } from '../../../../lib/passkey';
import { P, mono, fs, sp } from '../../theme';
import { Btn, Label, Input } from '../../shared/ui';

const PIN_LEN = 4; // product decision — brute-force guard is the server lockout

// Self-only PIN + passkey controls for the signed-in admin's own account.
// Reused by AccountsPanel (S-6 roster tool, self-only branch) and
// SelfAccountPanel (S-5's own lightweight settings surface) so the
// set-pin/clear-pin/revoke-passkeys wiring lives in one place. No
// target-email prop beyond the caller's own — those edge functions reject
// anything but the caller's own email server-side regardless.
export default function SelfCredentialControls({ email, hasPin, hasPasskey, onChange }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  function flash(msg) { setBusy(msg); setTimeout(() => setBusy(''), 2000); }

  async function setAccountPin() {
    setErr('');
    if (!new RegExp(`^\\d{${PIN_LEN}}$`).test(pin)) { setErr(`PIN must be exactly ${PIN_LEN} digits.`); return; }
    const { data, error } = await SB.functions.invoke('set-pin', { body: { email, pin } });
    if (error || data?.error) { setErr(`Set PIN failed: ${data?.error || error.message}`); return; }
    setPin('');
    flash('PIN set ✓');
    onChange?.();
  }

  async function clearAccountPin() {
    if (!confirm('Remove your PIN?')) return;
    setErr('');
    const { data, error } = await SB.functions.invoke('clear-pin', { body: { email } });
    if (error || data?.error) { setErr(`Clear PIN failed: ${data?.error || error.message}`); return; }
    flash('PIN cleared ✓');
    onChange?.();
  }

  async function registerThisDevice() {
    setErr('');
    try {
      await registerPasskey(navigator.platform || 'this device');
      flash('Touch ID registered ✓');
      onChange?.();
    } catch (e) {
      setErr(`Register failed: ${e.message}`);
    }
  }

  async function revokePasskeys() {
    if (!confirm("Revoke ALL passkeys (Touch ID)? You'll need to re-register.")) return;
    setErr('');
    const { data, error } = await SB.functions.invoke('revoke-passkeys', { body: { email } });
    if (error || data?.error) { setErr(`Revoke failed: ${data?.error || error.message}`); return; }
    flash('Passkeys revoked ✓');
    onChange?.();
  }

  return (
    <>
      <Label>PIN · {hasPin ? <span style={{ color: P.green }}>set</span> : <span style={{ color: P.faint }}>none</span>}</Label>
      <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[3], alignItems: 'center' }}>
        <Input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LEN))}
          placeholder={`${PIN_LEN}-digit PIN`}
          inputMode="numeric"
          style={{ maxWidth: 160, letterSpacing: '0.4em', fontFamily: mono }}
        />
        <Btn onClick={setAccountPin} variant="gold" size="sm">SET PIN</Btn>
        {hasPin && <Btn onClick={clearAccountPin} variant="ghost" size="sm">CLEAR</Btn>}
      </div>
      <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, lineHeight: 1.7, marginBottom: sp[5] }}>
        4-digit PIN. Hashed server-side; the login enforces a 5-fail → 15-min lockout. PIN never stored in the browser.
      </div>

      <Label>Passkey / Touch ID · {hasPasskey ? <span style={{ color: P.green }}>registered</span> : <span style={{ color: P.faint }}>none</span>}</Label>
      <div style={{ display: 'flex', gap: sp[2], alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn onClick={registerThisDevice} variant="gold" size="sm">+ REGISTER TOUCH ID (THIS DEVICE)</Btn>
        <Btn onClick={revokePasskeys} variant="ghost" size="sm" disabled={!hasPasskey}>REVOKE PASSKEYS</Btn>
      </div>
      <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, marginTop: sp[2] }}>
        Touch ID binds to the device you register it on — each person registers on their own machine, and only for their own account.
      </div>

      {busy && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.green, marginTop: sp[4] }}>{busy}</div>}
      {err && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.red, marginTop: sp[4], lineHeight: 1.6 }}>{err}</div>}
    </>
  );
}
