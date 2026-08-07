import { useState } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { getDeviceId } from '../../../../lib/fingerprint';
import { P, mono, fs, sp, radius } from '../../theme';
import { Btn, Label, Input } from '../../shared/ui';

const PIN_LEN = 4;

// Step-up confirm for a single-photo Push-to-TV. Re-enters a PIN even though
// the admin is already logged into DISPATCH (step-up auth, per product
// spec), and the push-tv-spotlight edge function additionally checks this
// browser's fingerprint against trusted_devices — so a wrong device fails
// even with a correct PIN, no distinct error message (see device_not_trusted
// below), pointing straight at registration instead of leaking device state.
export default function TvSpotlightPushModal({ photo, onClose, onPushed }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [untrusted, setUntrusted] = useState(false);

  async function push() {
    setErr(''); setUntrusted(false);
    if (!new RegExp(`^\\d{${PIN_LEN}}$`).test(pin)) { setErr(`PIN must be exactly ${PIN_LEN} digits.`); return; }
    setBusy(true);
    try {
      const fingerprint = await getDeviceId();
      const { data, error } = await SB.functions.invoke('push-tv-spotlight', {
        body: { photo_url: photo.photo_url, pin, fingerprint },
      });
      if (error || data?.error) {
        const code = data?.error;
        if (code === 'device_not_trusted') { setUntrusted(true); return; }
        setErr(
          code === 'locked' ? `Too many failed PINs — locked until ${new Date(data.until).toLocaleTimeString()}.`
          : code === 'invalid' ? `Wrong PIN.${data.remaining != null ? ` ${data.remaining} attempt(s) left.` : ''}`
          : `Push failed: ${code || error.message}`
        );
        return;
      }
      onPushed?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,16,31,0.9)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: sp[6] }}>
      <div style={{ background: P.navy, border: `1px solid ${P.hairStrong}`, borderRadius: radius.md, padding: sp[5], width: 380, maxWidth: '90vw' }}>
        <Label>PUSH TO TV</Label>
        <img src={photo.photo_url} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 5, marginBottom: sp[3] }} />

        {untrusted ? (
          <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.gold, lineHeight: 1.7, marginBottom: sp[4] }}>
            This device isn't registered for Push-to-TV. Register it under MY TERMINALS below, then try again.
          </div>
        ) : (
          <>
            <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, lineHeight: 1.7, marginBottom: sp[3] }}>
              Re-enter your PIN to feature this photo on the live TV now.
            </div>
            <Input
              value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LEN))}
              placeholder="4-digit PIN" inputMode="numeric" autoFocus
              style={{ marginBottom: sp[3], letterSpacing: '0.4em', fontFamily: mono }}
            />
          </>
        )}

        {err && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.red, marginBottom: sp[3], lineHeight: 1.6 }}>{err}</div>}

        <div style={{ display: 'flex', gap: sp[2], justifyContent: 'flex-end' }}>
          <Btn variant="ghost" size="sm" onClick={onClose}>CANCEL</Btn>
          {!untrusted && <Btn variant="gold" size="sm" onClick={push} disabled={busy}>{busy ? 'PUSHING…' : 'PUSH NOW'}</Btn>}
        </div>
      </div>
    </div>
  );
}
