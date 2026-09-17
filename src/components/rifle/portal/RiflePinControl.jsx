import { useState } from 'react';
import { rifleSetPin, rifleClearPin } from '../../../lib/rifleAdminApi';
import { P, mono } from '../theme';

const PIN_LEN = 4;

// Self-only PIN set/clear for Makaio — same shape as ReviewerPinControl.jsx.
// No target-email prop for a reason: rifle-set-pin/rifle-clear-pin reject
// anything but the caller's own email server-side.
export default function RiflePinControl({ email, hasPin, onChange }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');

  async function doSet() {
    if (!new RegExp(`^\\d{${PIN_LEN}}$`).test(pin)) { setErr(`PIN must be exactly ${PIN_LEN} digits.`); return; }
    setBusy(true); setErr('');
    const { error } = await rifleSetPin(email, pin);
    setBusy(false);
    if (error) { setErr(error); return; }
    setPin('');
    setFlash('PIN set ✓');
    setTimeout(() => setFlash(''), 2000);
    onChange?.(true);
  }

  async function doClear() {
    setBusy(true); setErr('');
    const { error } = await rifleClearPin(email);
    setBusy(false);
    if (error) { setErr(error); return; }
    setFlash('PIN cleared ✓');
    setTimeout(() => setFlash(''), 2000);
    onChange?.(false);
  }

  const label = { fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.14em', marginBottom: 8, display: 'block' };
  const input = {
    width: 140, boxSizing: 'border-box', background: P.deep, border: `1px solid ${P.hair}`,
    color: P.cream, fontFamily: mono, fontSize: 16, letterSpacing: '0.4em', textAlign: 'center',
    padding: '10px 8px', outline: 'none',
  };
  const btn = (primary) => ({
    background: primary ? P.gold : 'transparent', color: primary ? P.ink : P.mute,
    border: primary ? 'none' : `1px solid ${P.hairStrong}`, fontFamily: mono, fontSize: 12,
    letterSpacing: '0.1em', fontWeight: 600, padding: '10px 16px', cursor: busy ? 'wait' : 'pointer',
  });

  return (
    <div>
      <label style={label}>4-DIGIT PIN &middot; {hasPin ? <span style={{ color: P.win }}>SET</span> : <span style={{ color: P.faint }}>NONE</span>}</label>
      <p style={{ fontFamily: mono, fontSize: 11, color: P.mute, lineHeight: 1.6, margin: '0 0 12px' }}>
        Optional. Sign in with a PIN instead of your password from this device. Locks 15 minutes after 5 wrong guesses.
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          value={pin} inputMode="numeric" placeholder={`${PIN_LEN} digits`}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LEN)); setErr(''); }}
          style={input}
        />
        <button onClick={doSet} disabled={busy} style={btn(true)}>{hasPin ? 'UPDATE' : 'SET PIN'}</button>
        {hasPin && <button onClick={doClear} disabled={busy} style={btn(false)}>CLEAR</button>}
      </div>
      {flash && <div style={{ fontFamily: mono, fontSize: 11, color: P.win, marginTop: 10 }}>{flash}</div>}
      {err && <div style={{ fontFamily: mono, fontSize: 11, color: P.red, marginTop: 10 }}>{err}</div>}
    </div>
  );
}
