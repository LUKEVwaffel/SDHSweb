import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, sp } from '../../theme';
import { Btn, Input, Label } from '../../shared/ui';

// Provisions /rifle/portal admin accounts (Makaio + whoever else). Was
// previously a fully manual two-step (create the Supabase Auth user in the
// dashboard, then hand-insert the rifle_admins row via the SQL editor — see
// rifle_admin_portal.sql's original comment) — rifle-admin-set now does both
// in one call. A fresh account gets a random temp password shown ONCE here;
// relay it to them, they set their own on first sign-in
// (RifleForcePasswordChange) same as every other password-gated account on
// this site.

function fmtTime(d) {
  return d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
}

function Badge({ tone = 'mute', children }) {
  const c = { green: P.green, red: P.red, gold: P.gold, mute: P.mute }[tone] || P.mute;
  return (
    <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 7px', border: `1px solid ${c}`, color: c, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

export default function RifleAdminAccountsTab() {
  const [accounts, setAccounts] = useState(null);
  const [fnMissing, setFnMissing] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await SB.rpc('rifle_admin_status');
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

  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp[3] }}>
        <p style={{ fontFamily: mono, fontSize: 12, color: P.mute, margin: 0, maxWidth: 460 }}>
          Rifle Team Admin (/rifle/portal). New accounts sign in with a temp
          password once, then set their own.
        </p>
        <Btn size="sm" variant="ghost" onClick={load}>REFRESH</Btn>
      </div>

      {fnMissing && (
        <div style={{ border: `1px solid ${P.hair}`, background: P.deep, padding: sp[3], marginBottom: sp[4], fontFamily: mono, fontSize: 11, color: P.mute, lineHeight: 1.6 }}>
          Run <b>supabase/rifle_admin_status.sql</b> to list rifle-admin accounts. Provisioning below still works without it.
        </div>
      )}
      {err && <div style={{ fontFamily: mono, fontSize: 12, color: P.red, marginBottom: sp[3] }}>{err}</div>}

      {!fnMissing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2], margin: `${sp[2]}px 0 ${sp[3]}px` }}>
          {accounts === null ? (
            <div style={{ fontFamily: mono, fontSize: 11, color: P.faint }}>Loading&hellip;</div>
          ) : accounts.length === 0 ? (
            <div style={{ fontFamily: mono, fontSize: 11, color: P.faint, border: `1px dashed ${P.hair}`, padding: sp[3] }}>
              No rifle-admin accounts yet.
            </div>
          ) : accounts.map((a) => (
            <div key={a.email} style={{ border: `1px solid ${P.hair}`, borderLeft: `3px solid ${a.active ? P.gold : P.hair}`, background: P.navy, padding: `${sp[2]}px ${sp[3]}px`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: sp[3] }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: mono, fontSize: 13, color: P.cream }}>{a.display_name}</div>
                <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 2 }}>
                  {a.email}{a.created_at ? ` · added ${fmtTime(a.created_at)}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: sp[1], flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {a.must_change_password && <Badge tone="gold">needs password</Badge>}
                <Badge tone={a.active ? 'green' : 'mute'}>{a.active ? 'active' : 'inactive'}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      <StaffAdder onDone={load} />
    </div>
  );
}

function StaffAdder({ onDone }) {
  const [row, setRow] = useState({ email: '', name: '' });
  const [flash, setFlash] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (field, value) => setRow((r) => ({ ...r, [field]: value }));

  async function submit() {
    if (!row.email.trim() || !row.name.trim() || !row.email.includes('@')) {
      setFlash('Name and a valid email are both required.');
      return;
    }
    setBusy(true); setFlash(''); setTempPassword('');
    const { data, error } = await SB.functions.invoke('rifle-admin-set', {
      body: { email: row.email.trim(), name: row.name.trim() },
    });
    setBusy(false);
    if (error || data?.error) { setFlash(`Failed: ${data?.error || error.message}`); return; }
    if (data.temp_password) {
      setTempPassword(data.temp_password);
      setFlash(`Account created — temp password below. Relay it to ${row.name.trim()}; it won't be shown again.`);
    } else {
      setFlash('Reactivated — their existing password still works.');
    }
    setRow({ email: '', name: '' });
    onDone();
  }

  return (
    <div style={{ border: `1px solid ${P.hair}`, padding: sp[3] }}>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: P.mute, marginBottom: sp[2] }}>
        Add / re-activate a rifle admin
      </div>
      <div style={{ display: 'flex', gap: sp[2], alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}><Label>NAME</Label><Input value={row.name} onChange={(e) => set('name', e.target.value)} placeholder="Admin name" /></div>
        <div style={{ flex: 1 }}><Label>EMAIL</Label><Input value={row.email} onChange={(e) => set('email', e.target.value)} placeholder="name@hcde.org" /></div>
        <Btn size="sm" variant="gold" disabled={busy} onClick={submit}>{busy ? 'SAVING…' : 'ADD'}</Btn>
      </div>
      {flash && <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: sp[2] }}>{flash}</div>}
      {tempPassword && (
        <div style={{ fontFamily: mono, fontSize: 14, color: P.gold, marginTop: sp[2], padding: sp[2], border: `1px solid ${P.gold}`, letterSpacing: '0.05em', userSelect: 'all' }}>
          {tempPassword}
        </div>
      )}
    </div>
  );
}
