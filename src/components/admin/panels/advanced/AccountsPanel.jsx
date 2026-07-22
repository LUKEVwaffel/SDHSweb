import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { registerPasskey } from '../../../../lib/passkey';
import { P, mono, inter, fs, sp, radius } from '../../theme';
import { Btn, Card, Label, Input, PanelHeader, EmptyState } from '../../shared/ui';

// DISPATCH login-account manager (S-6 only — lives under the Advanced wall).
// Reads the public login_accounts view for the roster (name / photo / method
// flags — never hashes), and writes name + avatar straight to admin_roles via
// the column-scoped s6 update grant from account_picker.sql (role is NOT
// writable here — the grant only exposes display_name + photo_url).
//
// PIN + passkey controls call the Phase 2 edge functions (set-pin / clear-pin /
// revoke-passkeys). They will return an error until those functions are
// deployed — surfaced inline, not hidden — so this panel is safe to ship now
// and the buttons light up the moment Phase 2 lands.
const AVATAR_BUCKET = 'admin-avatars';
const PIN_LEN = 4; // product decision — brute-force guard is the server lockout

function slug(email) {
  return String(email || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

export default function AccountsPanel({ adminId }) {
  const [rows, setRows] = useState([]);
  const [missing, setMissing] = useState(false);
  const [sel, setSel] = useState(null);       // selected account email
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');      // picker rank/position label
  const [busy, setBusy] = useState('');        // transient status line
  const [err, setErr] = useState('');
  const [pin, setPin] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    const { data, error } = await SB.from('login_accounts').select('*').order('display_name');
    if (error) { setMissing(true); return; }
    setMissing(false);
    setRows(data || []);
    setSel((prev) => (prev && data.some((r) => r.email === prev) ? prev : null));
  }, []);
  useEffect(() => { load(); }, [load]);

  const selected = rows.find((r) => r.email === sel) || null;
  // Self-only credential controls: PIN + passkeys can be managed ONLY for your
  // own account, never someone else's — enforced server-side too (set-pin /
  // clear-pin / revoke-passkeys reject non-self). Name/photo/title stay editable
  // for any account (S-6 curates the roster identity).
  const isSelf = !!selected && String(selected.email).toLowerCase() === String(adminId).toLowerCase();

  function pick(r) {
    setSel(r.email);
    setName(r.display_name || '');
    setTitle(r.title || '');
    setPin('');
    setBusy('');
    setErr('');
  }

  function flash(msg) { setBusy(msg); setTimeout(() => setBusy(''), 2000); }

  async function saveIdentity() {
    if (!selected) return;
    setErr('');
    const { error } = await SB.from('admin_roles')
      .update({ display_name: name.trim() || null, title: title.trim() || null })
      .eq('email', selected.email);
    if (error) { setErr(`Save failed: ${error.message}`); return; }
    flash('Saved ✓');
    load();
  }

  async function onAvatarFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file || !selected) return;
    setErr('');
    if (!file.type.startsWith('image/')) { setErr('Choose an image file.'); return; }
    // Server policy also enforces image/* — this is the friendly first line.
    setUploading(true);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${slug(selected.email)}_${Date.now()}.${ext}`;
    const up = await SB.storage.from(AVATAR_BUCKET).upload(path, file, { contentType: file.type, upsert: true });
    if (up.error) { setUploading(false); setErr(`Upload failed: ${up.error.message}`); return; }
    const url = SB.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
    const { error } = await SB.from('admin_roles').update({ photo_url: url }).eq('email', selected.email);
    setUploading(false);
    if (error) { setErr(`Save failed: ${error.message}`); return; }
    flash('Photo updated ✓');
    load();
  }

  // ---- Phase 2 edge-function calls (set-pin / clear-pin / revoke-passkeys) ----
  async function setAccountPin() {
    if (!selected) return;
    setErr('');
    if (!new RegExp(`^\\d{${PIN_LEN}}$`).test(pin)) { setErr(`PIN must be exactly ${PIN_LEN} digits.`); return; }
    const { data, error } = await SB.functions.invoke('set-pin', { body: { email: selected.email, pin } });
    if (error || data?.error) { setErr(`Set PIN failed: ${data?.error || error.message} (edge function may not be deployed yet — Phase 2)`); return; }
    setPin('');
    flash('PIN set ✓');
    load();
  }
  async function clearAccountPin() {
    if (!selected || !confirm(`Remove the PIN for ${selected.display_name || selected.email}?`)) return;
    setErr('');
    const { data, error } = await SB.functions.invoke('clear-pin', { body: { email: selected.email } });
    if (error || data?.error) { setErr(`Clear PIN failed: ${data?.error || error.message} (Phase 2)`); return; }
    flash('PIN cleared ✓');
    load();
  }
  async function registerThisDevice() {
    setErr('');
    try {
      await registerPasskey(navigator.platform || 'this device');
      flash('Touch ID registered ✓');
      load();
    } catch (e) {
      setErr(`Register failed: ${e.message}`);
    }
  }
  async function revokePasskeys() {
    if (!selected || !confirm(`Revoke ALL passkeys (Touch ID) for ${selected.display_name || selected.email}? They will need to re-register.`)) return;
    setErr('');
    const { data, error } = await SB.functions.invoke('revoke-passkeys', { body: { email: selected.email } });
    if (error || data?.error) { setErr(`Revoke failed: ${data?.error || error.message} (Phase 2)`); return; }
    flash('Passkeys revoked ✓');
    load();
  }

  if (missing) {
    return (
      <Card>
        <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, lineHeight: 1.9 }}>
          <div style={{ color: P.gold }}>ACCOUNT PICKER TABLES NOT FOUND</div>
          <div>Run <span style={{ color: P.cream }}>supabase/account_picker.sql</span> first.</div>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <PanelHeader title="ACCOUNTS" sub="Login picker — name, title & photo for anyone; PIN & passkey for your own account only" />
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: sp[4] }}>
        {/* roster */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2] }}>
          {rows.length === 0 && <EmptyState icon="◍" title="NO ACCOUNTS" hint="admin_roles has no rows yet." />}
          {rows.map((r) => (
            <div key={r.email} onClick={() => pick(r)} style={{
              display: 'flex', alignItems: 'center', gap: sp[3], cursor: 'pointer',
              background: sel === r.email ? P.navy : P.deep,
              border: `1px solid ${sel === r.email ? P.gold : P.hair}`,
              borderRadius: radius.sm, padding: '10px 12px',
            }}>
              {r.photo_url
                ? <img src={r.photo_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${P.hairStrong}` }} />
                : <div style={{ width: 40, height: 40, borderRadius: '50%', background: P.navy, border: `1px solid ${P.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: fs.md, color: P.gold }}>{(r.display_name || r.email || '?').charAt(0).toUpperCase()}</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.display_name || <span style={{ color: P.faint }}>Unnamed</span>}</div>
                <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <MethodDot on={r.has_pin} label="PIN" />
                <MethodDot on={r.has_passkey} label="KEY" />
              </div>
            </div>
          ))}
        </div>

        {/* editor */}
        <div>
          {!selected ? (
            <EmptyState icon="☰" title="SELECT AN ACCOUNT" hint="Set the display name, photo, PIN, and passkeys used on the login picker." />
          ) : (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: sp[4], marginBottom: sp[5] }}>
                {selected.photo_url
                  ? <img src={selected.photo_url} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${P.gold}` }} />
                  : <div style={{ width: 72, height: 72, borderRadius: '50%', background: P.deep, border: `1px solid ${P.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: fs.xl, color: P.gold }}>{(selected.display_name || selected.email).charAt(0).toUpperCase()}</div>}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: inter, fontSize: fs.md, color: P.cream }}>{selected.display_name || 'Unnamed account'}</div>
                  <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, marginTop: 3 }}>{selected.email}</div>
                </div>
              </div>

              <Label>Display name</Label>
              <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[3] }}>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name shown on the login card" />
              </div>

              <Label>Position / title</Label>
              <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[2] }}>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. S-6 · Deputy S-5 · Assistant S-6, Developer" />
                <Btn onClick={saveIdentity} variant="gold" size="sm">SAVE</Btn>
              </div>
              <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, lineHeight: 1.7, marginBottom: sp[5] }}>
                Shown as the rank tab under the name on the login picker. Saves name + title together.
              </div>

              <Label>Photo</Label>
              <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[5], alignItems: 'center' }}>
                <input ref={fileRef} type="file" accept="image/*" onChange={onAvatarFile} style={{ display: 'none' }} />
                <Btn onClick={() => fileRef.current?.click()} variant="ghost" size="sm" disabled={uploading}>{uploading ? 'UPLOADING…' : 'UPLOAD PHOTO'}</Btn>
                <span style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint }}>PNG / JPG / WebP / GIF · public login avatar</span>
              </div>

              {/* Credential controls are SELF-ONLY: you can set/clear a PIN or
                  manage passkeys only for your own account. Enforced server-side
                  too — set-pin / clear-pin / revoke-passkeys reject non-self. */}
              {isSelf ? (
                <>
                  <Label>PIN · {selected.has_pin ? <span style={{ color: P.green }}>set</span> : <span style={{ color: P.faint }}>none</span>}</Label>
                  <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[3], alignItems: 'center' }}>
                    <Input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LEN))} placeholder={`${PIN_LEN}-digit PIN`} inputMode="numeric" style={{ maxWidth: 160, letterSpacing: '0.4em', fontFamily: mono }} />
                    <Btn onClick={setAccountPin} variant="gold" size="sm">SET PIN</Btn>
                    {selected.has_pin && <Btn onClick={clearAccountPin} variant="ghost" size="sm">CLEAR</Btn>}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, lineHeight: 1.7, marginBottom: sp[5] }}>
                    4-digit PIN. Hashed server-side; the login enforces a 5-fail → 15-min lockout. PIN never stored in the browser.
                  </div>

                  <Label>Passkey / Touch ID · {selected.has_passkey ? <span style={{ color: P.green }}>registered</span> : <span style={{ color: P.faint }}>none</span>}</Label>
                  <div style={{ display: 'flex', gap: sp[2], alignItems: 'center', flexWrap: 'wrap' }}>
                    <Btn onClick={registerThisDevice} variant="gold" size="sm">+ REGISTER TOUCH ID (THIS DEVICE)</Btn>
                    <Btn onClick={revokePasskeys} variant="ghost" size="sm" disabled={!selected.has_passkey}>REVOKE PASSKEYS</Btn>
                  </div>
                  <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, marginTop: sp[2] }}>
                    Touch ID binds to the device you register it on — each person registers on their own machine, and only for their own account.
                  </div>
                </>
              ) : (
                <div style={{
                  fontFamily: mono, fontSize: fs.micro, color: P.faint, lineHeight: 1.8,
                  border: `1px solid ${P.hair}`, borderRadius: radius.sm, padding: `${sp[3]}px ${sp[4]}px`,
                }}>
                  <div style={{ color: P.mute, marginBottom: 4 }}>PIN &amp; passkey · <span style={{ color: P.gold }}>owner-only</span></div>
                  Sign-in credentials can be managed only by the account owner, signed in as this account.
                  A forgotten PIN falls back to password login, or a password reset from the Supabase dashboard.
                </div>
              )}

              {busy && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.green, marginTop: sp[4] }}>{busy}</div>}
              {err && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.red, marginTop: sp[4], lineHeight: 1.6 }}>{err}</div>}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function MethodDot({ on, label }) {
  return (
    <span title={`${label}: ${on ? 'set' : 'none'}`} style={{
      fontFamily: mono, fontSize: 8, letterSpacing: '0.06em',
      color: on ? P.ink : P.faint, background: on ? P.gold : 'transparent',
      border: `1px solid ${on ? P.gold : P.hair}`, borderRadius: 3, padding: '2px 4px',
    }}>{label}</span>
  );
}
