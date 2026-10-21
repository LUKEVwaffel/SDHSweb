import { useState, useEffect } from 'react';
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
// tab only grants (never revokes) — see AUTH tab for that.
//
// The person picked here MUST already have a Supabase Auth login — the
// picker below is admin_auth_directory(), not a free-text name+email form.
// Creating a brand-new login (and naming it, if it doesn't have a name yet)
// only happens on the AUTH tab; this tab can only grant more portals to
// someone who already exists there.
//
// Email Review / Ball Payments / Rifle Signups used to be ONE bundled
// "Reviewer Portal" checkbox — one grant meant all three, with no way to
// give just one (email_reviewer_capability_split.sql). They're three
// separate checkboxes now, sharing one login+PIN (one admin-set-reviewer-pin
// call, since they're still the same email_reviewers row) but independently
// grantable/revocable capabilities.

const REVIEWER_PORTALS = [
  { key: 'email_review', field: 'can_email_review', label: 'Reviewer — Email Review', hint: '/review — approve or deny outgoing DISPATCH email.' },
  { key: 'ball_ops', field: 'can_ball_ops', label: 'Reviewer — Ball Payments', hint: '/ball/ops — Military Ball cash + field-trip forms.' },
  { key: 'rifle_signups', field: 'can_rifle_signups', label: 'Reviewer — Rifle Signups', hint: '/rifle/signup-review — view rifle team interest signups.' },
];

const OTHER_PORTALS = [
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

const INITIAL_CHECKED = { email_review: false, ball_ops: false, rifle_signups: false, female_dress: false, male_guest_attire: false, rifle_admin: false };

export default function AssignAccessTab() {
  const [directory, setDirectory] = useState(null);
  const [dirErr, setDirErr] = useState('');
  const [search, setSearch] = useState('');
  const [showMatches, setShowMatches] = useState(false);
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(INITIAL_CHECKED);
  const [title, setTitle] = useState('');
  const [pin, setPin] = useState('');
  const [activateNow, setActivateNow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [formErr, setFormErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await SB.rpc('admin_auth_directory');
      if (error) { setDirErr(error.message); setDirectory([]); return; }
      setDirectory(data || []);
    })();
  }, []);

  const toggle = (key) => setChecked((c) => ({ ...c, [key]: !c[key] }));
  const anyChecked = Object.values(checked).some(Boolean);
  const anyReviewer = checked.email_review || checked.ball_ops || checked.rifle_signups;

  const term = search.trim().toLowerCase();
  const matches = term && directory
    ? directory.filter((d) => (d.display_name || '').toLowerCase().includes(term) || d.email.toLowerCase().includes(term)).slice(0, 8)
    : [];

  function pickPerson(account) {
    setSelected(account);
    setSearch('');
    setShowMatches(false);
  }

  async function submit() {
    setFormErr('');
    setResults(null);
    if (!selected) {
      setFormErr('Pick an existing login above — new people are added on the AUTH tab.');
      return;
    }
    const trimmedName = (selected.display_name || '').trim();
    const trimmedEmail = selected.email.trim();
    if (!trimmedName) {
      setFormErr(`${trimmedEmail} has no name yet — name it on the AUTH tab first.`);
      return;
    }
    if (!anyChecked) {
      setFormErr('Pick at least one portal to grant.');
      return;
    }
    if (anyReviewer && !/^\d{4}$/.test(pin)) {
      setFormErr('Reviewer Portal needs a 4-digit PIN.');
      return;
    }

    setBusy(true);
    const jobs = [];
    if (anyReviewer) {
      const granted = REVIEWER_PORTALS.filter((p) => checked[p.key]).map((p) => p.label.replace('Reviewer — ', ''));
      jobs.push({
        key: 'reviewer', label: `Reviewer Portal (${granted.join(', ')})`,
        run: () => SB.functions.invoke('admin-set-reviewer-pin', {
          body: {
            email: trimmedEmail, display_name: trimmedName, title: title.trim() || null, pin, activate_now: activateNow,
            ...(checked.email_review ? { can_email_review: true } : {}),
            ...(checked.ball_ops ? { can_ball_ops: true } : {}),
            ...(checked.rifle_signups ? { can_rifle_signups: true } : {}),
          },
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
      setChecked(INITIAL_CHECKED);
      setPin(''); setTitle(''); setActivateNow(false);
      setSelected(null);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <p style={{ fontFamily: mono, fontSize: 12, color: P.mute, margin: `0 0 ${sp[4]}px`, maxWidth: 520 }}>
        Grant an existing login any combination of the small staff portals in a single submit. The three Reviewer boxes
        share one login+PIN but are independently grantable — checking Ball Payments does not also grant Email Review.
        This tab never creates a new person — pick a login that already exists below, or create one on the AUTH tab first.
      </p>

      <div style={{ position: 'relative', marginBottom: sp[3] }}>
        <Label>FIND AN EXISTING LOGIN</Label>
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowMatches(true); }}
          onFocus={() => setShowMatches(true)}
          onBlur={() => setTimeout(() => setShowMatches(false), 150)}
          placeholder="Type a name or email…"
          disabled={directory === null}
        />
        {dirErr && <div style={{ fontFamily: mono, fontSize: 11, color: P.red, marginTop: sp[1] }}>{dirErr}</div>}
        {showMatches && matches.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, marginTop: 4,
            background: P.navy, border: `1px solid ${P.hairStrong}`, maxHeight: 240, overflowY: 'auto',
          }}>
            {matches.map((m) => (
              <div
                key={m.id}
                onMouseDown={() => pickPerson(m)}
                style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: `1px solid ${P.hair}` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = P.deep; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ fontFamily: mono, fontSize: 13, color: P.cream }}>{m.display_name || <span style={{ color: P.faint }}>Unnamed</span>}</div>
                <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 1 }}>{m.email}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: sp[2], marginBottom: sp[4], fontFamily: mono, fontSize: 12, color: P.mute }}>
          Selected: <span style={{ color: P.cream }}>{selected.display_name || 'Unnamed'}</span> — {selected.email}
          <button
            type="button"
            onClick={() => setSelected(null)}
            style={{ background: 'none', border: 'none', color: P.gold, fontFamily: mono, fontSize: 11, cursor: 'pointer', padding: 0 }}
          >
            change
          </button>
        </div>
      )}

      <Label>PORTALS TO GRANT</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2], margin: `${sp[2]}px 0 ${sp[4]}px` }}>
        {[...REVIEWER_PORTALS, ...OTHER_PORTALS].map((p) => (
          <label key={p.key} style={{ ...checkboxRow, borderColor: checked[p.key] ? P.gold : P.hair }}>
            <input type="checkbox" checked={checked[p.key]} onChange={() => toggle(p.key)} style={{ marginTop: 3 }} />
            <div>
              <div style={{ fontFamily: mono, fontSize: 13, color: P.cream }}>{p.label}</div>
              <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 2 }}>{p.hint}</div>
            </div>
          </label>
        ))}
      </div>

      {anyReviewer && (
        <div style={{ border: `1px solid ${P.hair}`, padding: sp[3], marginBottom: sp[4] }}>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: P.mute, marginBottom: sp[2] }}>
            Reviewer login needs
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
