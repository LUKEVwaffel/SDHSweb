import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, sp } from '../../theme';
import { Btn, Input, Label } from '../../shared/ui';

// Raw Supabase Auth directory — the prerequisite layer underneath every
// portal on this site, PLUS the one place to reset a password, revoke a
// single portal, or delete an account entirely. Reviewer / Rifle Admin /
// DISPATCH admin_roles / Ball Dress-Attire accounts all need a real
// Supabase Auth login to exist before their own table row means anything;
// that used to mean opening the Supabase dashboard (Authentication → Users)
// by hand for creation, resets, and deletes alike. Read via
// admin_auth_directory() (SQL, is_s6-gated, joins every portal table by
// email so this list can show a real name + what's currently active).
// Writes go through three small edge functions since the Admin API is the
// only supported way to touch a real password or delete a login:
//   admin-create-auth-user    — new login, temp password
//   admin-reset-auth-password — new temp password on an existing login
//   admin-set-portal-active   — revoke/restore ONE portal (not admin_roles —
//                                DISPATCH access stays in the People panel)
//   admin-delete-auth-user    — full purge, admin_roles included

const fmtTime = (d) => (d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');

function Badge({ tone = 'mute', children }) {
  const c = { green: P.green, red: P.red, gold: P.gold, mute: P.mute }[tone] || P.mute;
  return (
    <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 7px', border: `1px solid ${c}`, color: c, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

const DRESS_LABEL = { female_dress: 'Dress Approval', male_guest_attire: 'Male Guest Attire' };

export default function AuthAccountsTab() {
  const [rows, setRows] = useState(null);
  const [fnMissing, setFnMissing] = useState(false);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await SB.rpc('admin_auth_directory');
    if (error) { setFnMissing(true); setRows([]); setErr(''); return; }
    setFnMissing(false);
    setErr('');
    setRows(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp[3] }}>
        <p style={{ fontFamily: mono, fontSize: 12, color: P.mute, margin: 0, maxWidth: 480 }}>
          Every Supabase Auth login on this site, with whatever portals it currently has. Create one below, then hand the
          email to Portal Access → ASSIGN or People for DISPATCH access.
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
            <AuthRow key={r.id} r={r} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} onChanged={load} />
          ))}
        </div>
      )}

      <CreateLogin onDone={load} />
    </div>
  );
}

function AuthRow({ r, open, onToggle, onChanged }) {
  const [busy, setBusy] = useState('');
  const [flash, setFlash] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');

  async function resetPassword() {
    setBusy('reset'); setFlash(''); setTempPassword('');
    const { data, error } = await SB.functions.invoke('admin-reset-auth-password', { body: { user_id: r.id, email: r.email } });
    setBusy('');
    if (error || data?.error) { setFlash(`Failed: ${data?.error || error.message}`); return; }
    setTempPassword(data.temp_password);
    setFlash("New temp password below — relay it to them; it won't be shown again.");
  }

  async function setActive(table, active) {
    setBusy(table); setFlash('');
    const { data, error } = await SB.functions.invoke('admin-set-portal-active', { body: { table, email: r.email, active } });
    setBusy('');
    if (error || data?.error) { setFlash(`Failed: ${data?.error || error.message}`); return; }
    onChanged();
  }

  async function deleteEntirely() {
    if (confirmDelete.trim().toLowerCase() !== r.email.toLowerCase()) return;
    setBusy('delete'); setFlash('');
    const { data, error } = await SB.functions.invoke('admin-delete-auth-user', { body: { user_id: r.id, email: r.email } });
    setBusy('');
    if (error || data?.error) { setFlash(`Failed: ${data?.error || error.message}`); return; }
    onChanged();
  }

  const hasAnyPortal = r.admin_role || r.reviewer_active != null || r.dress_role || r.rifle_admin_active != null;

  return (
    <div style={{ background: P.navy, border: `1px solid ${P.hair}`, borderLeft: `3px solid ${r.email_confirmed_at ? P.gold : P.hair}` }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: `${sp[2]}px ${sp[3]}px`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: sp[3] }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: mono, fontSize: 13, color: P.cream }}>{r.display_name || <span style={{ color: P.faint }}>Unnamed</span>}</div>
          <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 2 }}>{r.email}</div>
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {r.admin_role && <Badge tone="gold">DISPATCH · {r.admin_role}</Badge>}
          {r.reviewer_active != null && <Badge tone={r.reviewer_active ? 'green' : 'mute'}>Reviewer{r.reviewer_active ? '' : ' (revoked)'}</Badge>}
          {r.dress_role && <Badge tone={r.dress_active ? 'green' : 'mute'}>{DRESS_LABEL[r.dress_role] || r.dress_role}{r.dress_active ? '' : ' (revoked)'}</Badge>}
          {r.rifle_admin_active != null && <Badge tone={r.rifle_admin_active ? 'green' : 'mute'}>Rifle Admin{r.rifle_admin_active ? '' : ' (revoked)'}</Badge>}
          {!hasAnyPortal && <Badge>no portals</Badge>}
        </div>
      </button>

      {open && (
        <div style={{ padding: `${sp[2]}px ${sp[3]}px ${sp[3]}px`, borderTop: `1px solid ${P.hair}`, display: 'flex', flexDirection: 'column', gap: sp[3] }}>
          <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, lineHeight: 1.7 }}>
            created {fmtTime(r.created_at)} · confirmed {r.email_confirmed_at ? 'yes' : 'no'} · last sign-in {fmtTime(r.last_sign_in_at)}
          </div>

          <div>
            <Label>REVOKE A PORTAL</Label>
            <div style={{ display: 'flex', gap: sp[2], flexWrap: 'wrap', marginTop: sp[1] }}>
              {r.reviewer_active != null && (
                <Btn size="sm" variant="ghost" disabled={busy === 'email_reviewers'} onClick={() => setActive('email_reviewers', !r.reviewer_active)}>
                  {busy === 'email_reviewers' ? '…' : r.reviewer_active ? 'REVOKE REVIEWER' : 'RESTORE REVIEWER'}
                </Btn>
              )}
              {r.dress_role && (
                <Btn size="sm" variant="ghost" disabled={busy === 'ball_dress_staff'} onClick={() => setActive('ball_dress_staff', !r.dress_active)}>
                  {busy === 'ball_dress_staff' ? '…' : r.dress_active ? `REVOKE ${(DRESS_LABEL[r.dress_role] || r.dress_role).toUpperCase()}` : 'RESTORE DRESS/ATTIRE'}
                </Btn>
              )}
              {r.rifle_admin_active != null && (
                <Btn size="sm" variant="ghost" disabled={busy === 'rifle_admins'} onClick={() => setActive('rifle_admins', !r.rifle_admin_active)}>
                  {busy === 'rifle_admins' ? '…' : r.rifle_admin_active ? 'REVOKE RIFLE ADMIN' : 'RESTORE RIFLE ADMIN'}
                </Btn>
              )}
              {!hasAnyPortal && <span style={{ fontFamily: mono, fontSize: 11, color: P.faint }}>Nothing to revoke — no portal rows for this email.</span>}
            </div>
            {r.admin_role && (
              <div style={{ fontFamily: mono, fontSize: 11, color: P.faint, marginTop: sp[1] }}>
                DISPATCH access ({r.admin_role}) is managed from the People panel, not here.
              </div>
            )}
          </div>

          <div>
            <Label>PASSWORD</Label>
            <Btn size="sm" variant="ghost" disabled={busy === 'reset'} onClick={resetPassword} style={{ marginTop: sp[1] }}>
              {busy === 'reset' ? 'RESETTING…' : 'RESET PASSWORD'}
            </Btn>
          </div>

          <div>
            <Label style={{ color: P.red }}>DELETE ENTIRELY</Label>
            <div style={{ fontFamily: mono, fontSize: 11, color: P.faint, margin: `${sp[1]}px 0` }}>
              Removes every portal row (Reviewer, Dress/Attire, Rifle Admin, DISPATCH) AND the Supabase Auth login. Cannot be undone.
              Type <b style={{ color: P.mute }}>{r.email}</b> to confirm.
            </div>
            <div style={{ display: 'flex', gap: sp[2], alignItems: 'center' }}>
              <Input value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} placeholder={r.email} style={{ maxWidth: 260 }} />
              <Btn
                size="sm" variant="danger"
                disabled={busy === 'delete' || confirmDelete.trim().toLowerCase() !== r.email.toLowerCase()}
                onClick={deleteEntirely}
              >
                {busy === 'delete' ? 'DELETING…' : 'DELETE ACCOUNT'}
              </Btn>
            </div>
          </div>

          {flash && <div style={{ fontFamily: mono, fontSize: 11, color: P.mute }}>{flash}</div>}
          {tempPassword && (
            <div style={{ fontFamily: mono, fontSize: 14, color: P.gold, padding: sp[2], border: `1px solid ${P.gold}`, letterSpacing: '0.05em', userSelect: 'all' }}>
              {tempPassword}
            </div>
          )}
        </div>
      )}
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
