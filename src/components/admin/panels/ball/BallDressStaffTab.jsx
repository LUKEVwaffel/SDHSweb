import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, sp } from '../../theme';
import { Btn, Input, Label } from '../../shared/ui';

// Provisions dress/attire verifier PINs via ball-dress-set-pin. Two roles:
//   • female_dress      — the people who approve female cadet + female guest
//                         attire (/ball/dress).
//   • male_guest_attire — Weston, who approves MALE GUEST attire only
//                         (/ball/attire).
// ball_dress_staff is service-role only, so the "who's set up" list comes from
// ball_dress_staff_status() (SECURITY DEFINER, is_s6 inside — run
// supabase/ball_dress_staff_status.sql). Each person must already exist as a
// Supabase Auth user before their first PIN login can mint a session.

const ROLE_LABEL = {
  female_dress: 'Female attire · /ball/dress',
  male_guest_attire: 'Male-guest attire · /ball/attire',
};

const fmtTime = (d) => (d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

function Badge({ tone = 'mute', children }) {
  const c = { green: P.green, red: P.red, gold: P.gold, mute: P.mute }[tone] || P.mute;
  return (
    <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 7px', border: `1px solid ${c}`, color: c, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

export default function BallDressStaffTab() {
  const [accounts, setAccounts] = useState(null);
  const [fnMissing, setFnMissing] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await SB.rpc('ball_dress_staff_status');
    if (error) {
      setFnMissing(true);
      setAccounts([]);
      setErr('');
      return;
    }
    setFnMissing(false);
    setErr('');
    setAccounts(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const byRole = (role) => (accounts || []).filter((a) => a.role === role);

  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp[3] }}>
        <p style={{ fontFamily: mono, fontSize: 12, color: P.mute, margin: 0, maxWidth: 460 }}>
          Each person must already have a Supabase Auth account (Dashboard → Authentication → Users) before their first PIN sign-in works.
        </p>
        <Btn size="sm" variant="ghost" onClick={load}>REFRESH</Btn>
      </div>

      {fnMissing && (
        <div style={{ border: `1px solid ${P.hair}`, background: P.deep, padding: sp[3], marginBottom: sp[4], fontFamily: mono, fontSize: 11, color: P.mute, lineHeight: 1.6 }}>
          Run <b>supabase/ball_dress_staff_status.sql</b> to list which attire accounts exist and their PIN state. Provisioning below still works without it.
        </div>
      )}
      {err && <div style={{ fontFamily: mono, fontSize: 12, color: P.red, marginBottom: sp[3] }}>{err}</div>}

      {['female_dress', 'male_guest_attire'].map((role) => (
        <div key={role} style={{ marginBottom: sp[5] }}>
          <Label>{ROLE_LABEL[role]}</Label>

          {!fnMissing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2], margin: `${sp[2]}px 0 ${sp[3]}px` }}>
              {byRole(role).length === 0 ? (
                <div style={{ fontFamily: mono, fontSize: 11, color: P.faint, border: `1px dashed ${P.hair}`, padding: sp[3] }}>
                  No accounts set up yet.
                </div>
              ) : byRole(role).map((a) => {
                const locked = a.pin_locked_until && new Date(a.pin_locked_until) > new Date();
                return (
                  <div key={a.email} style={{ border: `1px solid ${P.hair}`, borderLeft: `3px solid ${a.active ? P.gold : P.hair}`, background: P.navy, padding: `${sp[2]}px ${sp[3]}px`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: sp[3] }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: mono, fontSize: 13, color: P.cream }}>{a.name}</div>
                      <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 2 }}>
                        {a.email}{a.updated_at ? ` · set ${fmtTime(a.updated_at)}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: sp[1], flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {!a.active && <Badge tone="mute">inactive</Badge>}
                      {locked && <Badge tone="red">locked {fmtTime(a.pin_locked_until)}</Badge>}
                      <Badge tone={a.has_pin ? 'green' : 'gold'}>{a.has_pin ? 'PIN set' : 'no PIN'}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <StaffAdder role={role} onDone={load} />
        </div>
      ))}
    </div>
  );
}

function StaffAdder({ role, onDone }) {
  const [row, setRow] = useState({ email: '', name: '', pin: '' });
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (field, value) => setRow((r) => ({ ...r, [field]: value }));

  async function submit() {
    if (!row.email.trim() || !row.name.trim() || !/^\d{4}$/.test(row.pin)) {
      setFlash('Name, email, and a 4-digit PIN are all required.');
      return;
    }
    setBusy(true); setFlash('');
    const { data, error } = await SB.functions.invoke('ball-dress-set-pin', {
      body: { email: row.email.trim(), name: row.name.trim(), pin: row.pin, role },
    });
    setBusy(false);
    if (error || data?.error) { setFlash(`Failed: ${data?.error || error.message}`); return; }
    setFlash('PIN set ✓');
    setRow({ email: '', name: '', pin: '' });
    onDone();
  }

  return (
    <div style={{ border: `1px solid ${P.hair}`, padding: sp[3] }}>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: P.mute, marginBottom: sp[2] }}>
        Add / reset an account
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: sp[2], marginBottom: sp[2] }}>
        <div><Label>NAME</Label><Input value={row.name} onChange={(e) => set('name', e.target.value)} placeholder="Approver name" /></div>
        <div><Label>EMAIL</Label><Input value={row.email} onChange={(e) => set('email', e.target.value)} placeholder="name@hcde.org" /></div>
      </div>
      <div style={{ display: 'flex', gap: sp[2], alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}><Label>SET 4-DIGIT PIN</Label><Input value={row.pin} onChange={(e) => set('pin', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" /></div>
        <Btn size="sm" variant="gold" disabled={busy} onClick={submit}>{busy ? 'SAVING…' : 'SET PIN'}</Btn>
      </div>
      {flash && <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: sp[2] }}>{flash}</div>}
    </div>
  );
}
