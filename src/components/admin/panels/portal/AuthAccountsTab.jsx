import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, sp } from '../../theme';
import { Btn, Input, Label } from '../../shared/ui';

// Raw Supabase Auth directory — the prerequisite layer underneath every
// portal on this site. Reviewer / Rifle Admin / DISPATCH admin_roles / Ball
// Dress-Attire accounts all need a real Supabase Auth login to exist before
// their own table row means anything; that used to mean opening the Supabase
// dashboard (Authentication → Users) by hand. This tab does the one thing
// that step did — create the login with a temp password — from inside
// DISPATCH, then Portal Access → ASSIGN (or People, for DISPATCH access)
// takes over from there. Read-only listing via admin_auth_directory() SQL
// function; creation via the admin-create-auth-user edge function (only the
// Admin API can set a real encrypted password, not a SQL insert).

const fmtTime = (d) => (d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');

function Badge({ tone = 'mute', children }) {
  const c = { green: P.green, red: P.red, gold: P.gold, mute: P.mute }[tone] || P.mute;
  return (
    <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 7px', border: `1px solid ${c}`, color: c, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

export default function AuthAccountsTab() {
  const [rows, setRows] = useState(null);
  const [fnMissing, setFnMissing] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await SB.rpc('admin_auth_directory');
    if (error) { setFnMissing(true); setRows([]); setErr(''); return; }
    setFnMissing(false);
    setErr('');
    setRows(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp[3] }}>
        <p style={{ fontFamily: mono, fontSize: 12, color: P.mute, margin: 0, maxWidth: 460 }}>
          Every Supabase Auth login on this site. Create one here first, then hand the email to Portal Access → ASSIGN or
          the People panel to put it on an actual portal or DISPATCH role.
        </p>
        <Btn size="sm" variant="ghost" onClick={load}>REFRESH</Btn>
      </div>

      {fnMissing && (
        <div style={{ border: `1px solid ${P.hair}`, background: P.deep, padding: sp[3], marginBottom: sp[4], fontFamily: mono, fontSize: 11, color: P.mute, lineHeight: 1.6 }}>
          Run <b>supabase/admin_auth_directory.sql</b> to list Supabase Auth users here. Creating a new login below still works without it.
        </div>
      )}
      {err && <div style={{ fontFamily: mono, fontSize: 12, color: P.red, marginBottom: sp[3] }}>{err}</div>}

      {!fnMissing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2], margin: `${sp[2]}px 0 ${sp[3]}px` }}>
          {rows === null ? (
            <div style={{ fontFamily: mono, fontSize: 11, color: P.faint }}>Loading&hellip;</div>
          ) : rows.length === 0 ? (
            <div style={{ fontFamily: mono, fontSize: 11, color: P.faint, border: `1px dashed ${P.hair}`, padding: sp[3] }}>
              No Supabase Auth users yet.
            </div>
          ) : rows.map((r) => (
            <div key={r.id} style={{ border: `1px solid ${P.hair}`, borderLeft: `3px solid ${r.email_confirmed_at ? P.gold : P.hair}`, background: P.navy, padding: `${sp[2]}px ${sp[3]}px`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: sp[3] }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: mono, fontSize: 13, color: P.cream }}>{r.email}</div>
                <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 2 }}>
                  created {fmtTime(r.created_at)} · last sign-in {fmtTime(r.last_sign_in_at)}
                </div>
              </div>
              <Badge tone={r.email_confirmed_at ? 'green' : 'mute'}>{r.email_confirmed_at ? 'confirmed' : 'unconfirmed'}</Badge>
            </div>
          ))}
        </div>
      )}

      <CreateLogin onDone={load} />
    </div>
  );
}

function CreateLogin({ onDone }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');
  const [tempPassword, setTempPassword] = useState('');

  async function submit() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) { setFlash('A valid email is required.'); return; }
    setBusy(true); setFlash(''); setTempPassword('');
    const { data, error } = await SB.functions.invoke('admin-create-auth-user', { body: { email: trimmed } });
    setBusy(false);
    if (error || data?.error) { setFlash(`Failed: ${data?.error || error.message}`); return; }
    if (data.created) {
      setTempPassword(data.temp_password);
      setFlash(`Login created — temp password below. Relay it to them; it won't be shown again.`);
    } else {
      setFlash('That email already has a Supabase Auth login.');
    }
    setEmail('');
    onDone();
  }

  return (
    <div style={{ border: `1px solid ${P.hair}`, padding: sp[3] }}>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: P.mute, marginBottom: sp[2] }}>
        Create a login
      </div>
      <div style={{ display: 'flex', gap: sp[2], alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}><Label>EMAIL</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@hcde.org" /></div>
        <Btn size="sm" variant="gold" disabled={busy} onClick={submit}>{busy ? 'CREATING…' : 'CREATE'}</Btn>
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
