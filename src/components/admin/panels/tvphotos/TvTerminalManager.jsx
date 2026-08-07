import { useState, useEffect } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { getDeviceId } from '../../../../lib/fingerprint';
import { P, mono, fs, sp } from '../../theme';
import { Btn, Label, Input } from '../../shared/ui';

const PIN_LEN = 4;

// Trusted-device registry for Push-to-TV. Luke-only surface (the whole
// TvPhotosPanel is gated upstream), so this reads/deletes trusted_devices
// directly via RLS (is_luke() + own-row-only) — only the INSERT (a new
// registration) needs to go through the PIN-gated register-tv-terminal edge
// function, since that's the one action that actually grants push access to
// a new machine.
export default function TvTerminalManager() {
  const [devices, setDevices] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [pin, setPin] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');

  useEffect(() => { loadDevices(); }, []);

  async function loadDevices() {
    const { data } = await SB.from('trusted_devices').select('id,fingerprint,label,created_at').order('created_at', { ascending: false });
    setDevices(data || []);
  }

  function flashMsg(msg) { setFlash(msg); setTimeout(() => setFlash(''), 2000); }

  async function revoke(id) {
    if (!confirm('Revoke this terminal? Push-to-TV will stop working from that device until re-registered.')) return;
    await SB.from('trusted_devices').delete().eq('id', id);
    loadDevices();
  }

  async function registerThisDevice() {
    setErr('');
    if (!new RegExp(`^\\d{${PIN_LEN}}$`).test(pin)) { setErr(`PIN must be exactly ${PIN_LEN} digits.`); return; }
    setBusy(true);
    try {
      const fingerprint = await getDeviceId();
      const { data, error } = await SB.functions.invoke('register-tv-terminal', {
        body: { pin, fingerprint, label: label.trim() || navigator.platform || 'this device' },
      });
      if (error || data?.error) {
        const code = data?.error;
        setErr(
          code === 'locked' ? `Too many failed PINs — locked until ${new Date(data.until).toLocaleTimeString()}.`
          : code === 'invalid' ? `Wrong PIN.${data.remaining != null ? ` ${data.remaining} attempt(s) left.` : ''}`
          : `Register failed: ${code || error.message}`
        );
        return;
      }
      setPin(''); setLabel(''); setRegistering(false);
      flashMsg('Terminal registered ✓');
      loadDevices();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: sp[6], paddingTop: sp[5], borderTop: `1px solid ${P.hair}` }}>
      <Label>MY TERMINALS · PUSH-TO-TV ACCESS</Label>
      <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, lineHeight: 1.7, marginBottom: sp[3] }}>
        Only registered terminals can push a photo spotlight to the live TV. Register a new machine (or after
        clearing your browser) any time — it only needs your PIN, not the old device.
      </div>

      {devices === null ? (
        <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute }}>LOADING…</div>
      ) : devices.length === 0 ? (
        <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.faint, marginBottom: sp[3] }}>No terminals registered yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2], marginBottom: sp[3] }}>
          {devices.map((d) => (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: sp[3],
              padding: `${sp[2]}px ${sp[3]}px`, background: P.deep, border: `1px solid ${P.hair}`, borderRadius: 5,
            }}>
              <div>
                <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.cream }}>{d.label || 'Unlabeled device'}</div>
                <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, marginTop: 2 }}>
                  registered {new Date(d.created_at).toLocaleDateString()}
                </div>
              </div>
              <Btn onClick={() => revoke(d.id)} variant="ghost" size="sm">REVOKE</Btn>
            </div>
          ))}
        </div>
      )}

      {registering ? (
        <div style={{ display: 'flex', gap: sp[2], alignItems: 'center', flexWrap: 'wrap' }}>
          <Input
            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LEN))}
            placeholder="4-digit PIN" inputMode="numeric"
            style={{ maxWidth: 130, letterSpacing: '0.4em', fontFamily: mono }}
          />
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" style={{ maxWidth: 180 }} />
          <Btn onClick={registerThisDevice} variant="gold" size="sm" disabled={busy}>{busy ? 'REGISTERING…' : 'CONFIRM'}</Btn>
          <Btn onClick={() => { setRegistering(false); setPin(''); setErr(''); }} variant="ghost" size="sm">CANCEL</Btn>
        </div>
      ) : (
        <Btn onClick={() => setRegistering(true)} variant="gold" size="sm">+ REGISTER THIS DEVICE</Btn>
      )}

      {flash && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.green, marginTop: sp[3] }}>{flash}</div>}
      {err && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.red, marginTop: sp[3], lineHeight: 1.6 }}>{err}</div>}
    </div>
  );
}
