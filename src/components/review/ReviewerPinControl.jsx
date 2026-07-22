import { useState } from 'react';
import { supabase as SB } from '../../lib/supabaseClient';

const PIN_LEN = 4;

// Self-only PIN set/clear for a reviewer. There is no target-email prop on
// purpose — set-reviewer-pin / clear-reviewer-pin reject anything but the
// caller's own email server-side (same posture as the admin set-pin /
// clear-pin), so this control only ever acts on "me". Reused in two places:
// the optional step right after a forced first-login password change, and
// the persistent settings panel a reviewer can reopen anytime.
export default function ReviewerPinControl({ email, hasPin, onChange }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');

  async function setReviewerPin() {
    if (!new RegExp(`^\\d{${PIN_LEN}}$`).test(pin)) { setErr(`PIN must be exactly ${PIN_LEN} digits.`); return; }
    setBusy(true);
    setErr('');
    const { data, error } = await SB.functions.invoke('set-reviewer-pin', { body: { pin } });
    setBusy(false);
    if (error || data?.error) { setErr(`Failed: ${data?.error || error.message}`); return; }
    setPin('');
    setFlash('PIN set ✓');
    setTimeout(() => setFlash(''), 2000);
    onChange?.(true);
  }

  async function clearReviewerPin() {
    setBusy(true);
    setErr('');
    const { data, error } = await SB.functions.invoke('clear-reviewer-pin', { body: {} });
    setBusy(false);
    if (error || data?.error) { setErr(`Failed: ${data?.error || error.message}`); return; }
    setFlash('PIN cleared ✓');
    setTimeout(() => setFlash(''), 2000);
    onChange?.(false);
  }

  return (
    <div>
      <label className="rv-label">
        4-digit PIN &middot; {hasPin ? <span style={{ color: 'var(--rv-green)' }}>set</span> : <span style={{ color: '#999' }}>none</span>}
      </label>
      <p className="rv-sub" style={{ fontSize: 12, marginTop: 2, marginBottom: 10 }}>
        Optional. Lets you sign in with a PIN instead of your password from this device. Locks for 15 minutes after 5 wrong guesses.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LEN)); setErr(''); }}
          placeholder={`${PIN_LEN}-digit PIN`}
          inputMode="numeric"
          className="rv-textarea"
          style={{ maxWidth: 140, letterSpacing: '0.4em', marginBottom: 0 }}
        />
        <button className="rv-btn primary" onClick={setReviewerPin} disabled={busy} style={{ width: 'auto', padding: '10px 18px' }}>
          {hasPin ? 'Update' : 'Set PIN'}
        </button>
        {hasPin && (
          <button className="rv-btn deny" onClick={clearReviewerPin} disabled={busy} style={{ width: 'auto', padding: '10px 18px' }}>
            Clear
          </button>
        )}
      </div>
      {flash && <div className="rv-sub" style={{ color: 'var(--rv-green)', fontSize: 12, marginTop: 8 }}>{flash}</div>}
      {err && <div className="rv-flash" style={{ marginTop: 8 }}>{err}</div>}
      <p className="rv-sub" style={{ fontSize: 11, marginTop: 10, marginBottom: 0, color: '#999' }}>
        Account: {email}
      </p>
    </div>
  );
}
