import { useState } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, sp } from '../../theme';
import { Btn, Input, Label } from '../../shared/ui';

// Provisions the 3 dress verifiers via ball-dress-set-pin. Not a roster
// browser — S-6 knows who the 3 people are; this just sets name/email/PIN
// for each. The dress verifier must already exist as a Supabase Auth user
// (dashboard, manual step) before their first PIN login can mint a session.
export default function BallDressStaffTab() {
  const [rows, setRows] = useState([{ email: '', name: '', pin: '' }, { email: '', name: '', pin: '' }, { email: '', name: '', pin: '' }]);
  const [flash, setFlash] = useState({});
  const [busy, setBusy] = useState(null);

  function set(i, field, value) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }

  async function submit(i) {
    const row = rows[i];
    if (!row.email.trim() || !row.name.trim() || !/^\d{4}$/.test(row.pin)) {
      setFlash((f) => ({ ...f, [i]: 'Name, email, and a 4-digit PIN are all required.' }));
      return;
    }
    setBusy(i);
    const { data, error } = await SB.functions.invoke('ball-dress-set-pin', {
      body: { email: row.email.trim(), name: row.name.trim(), pin: row.pin },
    });
    setBusy(null);
    if (error || data?.error) { setFlash((f) => ({ ...f, [i]: `Failed: ${data?.error || error.message}` })); return; }
    setFlash((f) => ({ ...f, [i]: 'PIN set ✓' }));
    set(i, 'pin', '');
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <p style={{ fontFamily: mono, fontSize: 12, color: P.mute, marginBottom: sp[4] }}>
        Each person must already have a Supabase Auth account (Dashboard → Authentication → Users) before their first PIN sign-in works.
      </p>
      {rows.map((row, i) => (
        <div key={i} style={{ border: `1px solid ${P.hair}`, padding: sp[3], marginBottom: sp[3] }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: sp[2], marginBottom: sp[2] }}>
            <div><Label>NAME</Label><Input value={row.name} onChange={(e) => set(i, 'name', e.target.value)} placeholder="Dress approver name" /></div>
            <div><Label>EMAIL</Label><Input value={row.email} onChange={(e) => set(i, 'email', e.target.value)} placeholder="name@hcde.org" /></div>
          </div>
          <div style={{ display: 'flex', gap: sp[2], alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}><Label>SET 4-DIGIT PIN</Label><Input value={row.pin} onChange={(e) => set(i, 'pin', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" /></div>
            <Btn size="sm" variant="gold" disabled={busy === i} onClick={() => submit(i)}>{busy === i ? 'SAVING…' : 'SET PIN'}</Btn>
          </div>
          {flash[i] && <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: sp[2] }}>{flash[i]}</div>}
        </div>
      ))}
    </div>
  );
}
