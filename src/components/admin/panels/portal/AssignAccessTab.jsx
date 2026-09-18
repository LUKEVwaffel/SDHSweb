import { useState } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, sp } from '../../theme';
import { Btn, Input, Label } from '../../shared/ui';

// One form to push a person onto any combination of the small staff portals
// in one submit, instead of visiting Reviewer / Dress-Attire / Rifle Admin
// separately for the same name+email. Calls the exact same edge functions
// those tabs use (admin-set-reviewer-pin, ball-dress-set-pin,
// rifle-admin-set) — no new authorization surface, just one shared front end
// over the three that already exist. Each portal's own tab in this panel
// remains the place to view rosters, deactivate, or delete an account; this
// tab only grants.

const PORTALS = [
  {
    key: 'reviewer',
    label: 'Reviewer Portal',
    hint: 'Email Review (/review) + Ball Payments (/ball/ops) + Rifle Signup viewer — one login, all three.',
  },
  {
    key: 'female_dress',
    label: 'Ball — Dress Approval',
    hint: 'Approve female cadet & guest attire photos (/ball/dress). Email-only login.',
  },
  {
    key: 'male_guest_attire',
    label: 'Ball — Male Guest Attire',
    hint: 'Approve male guest attire photos (/ball/attire). Email-only login.',
  },
  {
    key: 'rifle_admin',
    label: 'Rifle Team Admin',
    hint: 'Roster + Comp Upload (CSV / AI-parsed match scores) at /rifle/portal.',
  },
];

const checkboxRow = { display: 'flex', alignItems: 'flex-start', gap: sp[2], padding: sp[3], border: `1px solid ${P.hair}`, cursor: 'pointer' };
const resultRow = (tone) => ({
  fontFamily: mono, fontSize: 12, padding: `${sp[2]}px ${sp[3]}px`, border: `1px solid ${tone === 'ok' ? P.green : P.red}`,
  color: tone === 'ok' ? P.green : P.red, marginBottom: sp[1],
});

export default function AssignAccessTab() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [checked, setChecked] = useState({ reviewer: false, female_dress: false, male_guest_attire: false, rifle_admin: false });
  const [title, setTitle] = useState('');
  const [pin, setPin] = useState('');
  const [activateNow, setActivateNow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [formErr, setFormErr] = useState('');

  const toggle = (key) => setChecked((c) => ({ ...c, [key]: !c[key] }));
  const anyChecked = Object.values(checked).some(Boolean);

  async function submit() {
    setFormErr('');
    setResults(null);
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail || !trimmedEmail.includes('@')) {
      setFormErr('Name and a valid email are both required.');
      return;
    }
    if (!anyChecked) {
      setFormErr('Pick at least one portal to grant.');
      return;
    }
    if (checked.reviewer && !/^\d{4}$/.test(pin)) {
      setFormErr('Reviewer Portal needs a 4-digit PIN.');
      return;
    }

    setBusy(true);
    const jobs = [];
    if (checked.reviewer) {
      jobs.push({
        key: 'reviewer', label: 'Reviewer Portal',
        run: () => SB.functions.invoke('admin-set-reviewer-pin', {
          body: { email: trimmedEmail, display_name: trimmedName, title: title.trim() || null, pin, activate_now: activateNow },
        }),
      });
    }
    if (checked.female_dress) {
      jobs.push({
        key: 'female_dress', label: 'Ball — Dress Approval',
        run: () => SB.functions.invoke('ball-dress-set-pin', { body: { email: trimmedEmail, name: trimmedName, role: 'female_dress' } }),
      });
    }
    if (checked.male_guest_attire) {
      jobs.push({
        key: 'male_guest_attire', label: 'Ball — Male Guest Attire',
        run: () => SB.functions.invoke('ball-dress-set-pin', { body: { email: trimmedEmail, name: trimmedName, role: 'male_guest_attire' } }),
      });
    }
    if (checked.rifle_admin) {
      jobs.push({
        key: 'rifle_admin', label: 'Rifle Team Admin',
        run: () => SB.functions.invoke('rifle-admin-set', { body: { email: trimmedEmail, name: trimmedName } }),
      });
    }

    const settled = await Promise.all(jobs.map(async (j) => {
      const { data, error } = await j.run();
      if (error || data?.error) return { key: j.key, label: j.label, ok: false, message: data?.error || error.message };
      const notes = [];
      if (data?.must_change_password) notes.push('needs to set their own password on first sign-in');
      if (data?.temp_password) notes.push(`temp password: ${data.temp_password}`);
      else if (j.key === 'rifle_admin') notes.push('reactivated — existing password still works');
      return { key: j.key, label: j.label, ok: true, message: notes.join(' · ') || 'granted' };
    }));
    setBusy(false);
    setResults(settled);
    if (settled.every((r) => r.ok)) {
      setChecked({ reviewer: false, female_dress: false, male_guest_attire: false, rifle_admin: false });
      setPin(''); setTitle(''); setActivateNow(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <p style={{ fontFamily: mono, fontSize: 12, color: P.mute, margin: `0 0 ${sp[4]}px`, maxWidth: 520 }}>
        Grant one person any combination of the small staff portals in a single submit. Each person must already exist as a
        Supabase Auth user for Reviewer / Rifle Admin (Dashboard → Authentication → Users) — Dress/Attire creates the sign-in
        account for you.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: sp[2], marginBottom: sp[4] }}>
        <div><Label>NAME</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></div>
        <div><Label>EMAIL</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@hcde.org" /></div>
      </div>

      <Label>PORTALS TO GRANT</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2], margin: `${sp[2]}px 0 ${sp[4]}px` }}>
        {PORTALS.map((p) => (
          <label key={p.key} style={{ ...checkboxRow, borderColor: checked[p.key] ? P.gold : P.hair }}>
            <input type="checkbox" checked={checked[p.key]} onChange={() => toggle(p.key)} style={{ marginTop: 3 }} />
            <div>
              <div style={{ fontFamily: mono, fontSize: 13, color: P.cream }}>{p.label}</div>
              <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 2 }}>{p.hint}</div>
            </div>
          </label>
        ))}
      </div>

      {checked.reviewer && (
        <div style={{ border: `1px solid ${P.hair}`, padding: sp[3], marginBottom: sp[4] }}>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: P.mute, marginBottom: sp[2] }}>
            Reviewer Portal needs
          </div>
          <div style={{ display: 'flex', gap: sp[2], alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 140 }}><Label>TITLE (optional)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="SAI, Sgt Kaz…" /></div>
            <div style={{ minWidth: 100 }}>
              <Label>4-DIGIT PIN</Label>
              <Input
                value={pin} inputMode="numeric" placeholder="••••"
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                style={{ letterSpacing: '0.5em', textAlign: 'center' }}
              />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: mono, fontSize: 11, color: P.mute, marginTop: sp[2], cursor: 'pointer' }}>
            <input type="checkbox" checked={activateNow} onChange={(e) => setActivateNow(e.target.checked)} />
            Password already set in the Supabase dashboard — skip the forced first-login change
          </label>
        </div>
      )}

      {formErr && <div style={{ fontFamily: mono, fontSize: 12, color: P.red, marginBottom: sp[3] }}>{formErr}</div>}

      <Btn variant="gold" disabled={busy} onClick={submit}>{busy ? 'GRANTING…' : 'GRANT ACCESS'}</Btn>

      {results && (
        <div style={{ marginTop: sp[4] }}>
          {results.map((r) => (
            <div key={r.key} style={resultRow(r.ok ? 'ok' : 'error')}>
              {r.label}: {r.ok ? r.message : `failed — ${r.message}`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
