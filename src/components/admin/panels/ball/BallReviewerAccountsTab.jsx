import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, sp, fs } from '../../theme';
import { Btn, Input, Label } from '../../shared/ui';

// S-6 provisioning for the review-portal accounts (Chief/SAI, Sgt Kaz, 1SG).
// ONE login per person covers BOTH /review (DISPATCH email approvals) and
// /ball/ops (Military Ball payment tracking) — same email_reviewers population.
//
// S-6 already owns the roster: email_reviewers has the email_reviewers_admin_all
// RLS policy, so activate/deactivate + display-name/title edits are plain
// PostgREST writes. The PIN hash + lockout live in reviewer_credentials
// (service-role only), so setting/clearing a PIN goes through the two s6-gated
// edge functions. reviewer_pin_status() (SECURITY DEFINER, is_s6 inside) is the
// only way S-6 can see who has a PIN / who is locked.

const fmtTime = (d) => (d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

function Badge({ children, tone }) {
  const c = { gold: P.gold, green: P.green, red: P.red, mute: P.mute }[tone] || P.mute;
  return (
    <span style={{
      fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.1em', padding: '3px 7px',
      border: `1px solid ${c}`, color: c, whiteSpace: 'nowrap', textTransform: 'uppercase',
    }}>
      {children}
    </span>
  );
}

export default function BallReviewerAccountsTab() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [statusFnMissing, setStatusFnMissing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await SB.rpc('reviewer_pin_status');
    if (error) {
      // reviewer_admin_pin_status.sql not run yet — fall back to the roster
      // alone (no has_pin / lockout visibility) so the tab still works.
      setStatusFnMissing(true);
      const { data: fallback, error: fErr } = await SB.from('email_reviewers').select('*').order('display_name');
      if (fErr) { setErr(fErr.message); setRows([]); return; }
      setErr('');
      setRows((fallback || []).map((r) => ({ ...r, has_pin: null, pin_locked_until: null })));
      return;
    }
    setStatusFnMissing(false);
    setErr('');
    setRows(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (rows === null) return <div style={{ fontFamily: mono, fontSize: 13, color: P.mute }}>LOADING…</div>;

  return (
    <div style={{ maxWidth: 640 }}>
      <p style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, lineHeight: 1.7, marginTop: 0, marginBottom: sp[4] }}>
        One account per reviewer, used for BOTH the email review portal (<code style={{ color: P.gold }}>/review</code>) and
        Ball payments (<code style={{ color: P.gold }}>/ball/ops</code>). Each person must first exist as a Supabase Auth
        user (Dashboard → Authentication → Users) before their PIN sign-in works.
      </p>

      {statusFnMissing && (
        <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, border: `1px solid ${P.hair}`, background: P.goldWash, padding: sp[3], marginBottom: sp[4] }}>
          Run <b>supabase/reviewer_admin_pin_status.sql</b> to show PIN / lockout status per reviewer. Provisioning still works without it.
        </div>
      )}
      {err && <div style={{ fontFamily: mono, fontSize: 12, color: P.red, marginBottom: sp[3] }}>{err}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2], marginBottom: sp[6] }}>
        {rows.map((r) => <ReviewerRow key={r.email} r={r} onDone={load} />)}
        {rows.length === 0 && (
          <div style={{ fontFamily: mono, fontSize: 13, color: P.mute, border: `1px dashed ${P.hairStrong}`, padding: sp[5], textAlign: 'center' }}>
            No reviewer accounts yet.
          </div>
        )}
      </div>

      <div style={{ height: 1, background: P.hair, margin: `0 0 ${sp[5]}px` }} />
      <AddReviewer onDone={load} />
    </div>
  );
}

function ReviewerRow({ r, onDone }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState('');
  const [flash, setFlash] = useState('');

  const locked = r.pin_locked_until && new Date(r.pin_locked_until) > new Date();

  async function setPinNow() {
    if (!/^\d{4}$/.test(pin)) { setFlash('PIN must be exactly 4 digits.'); return; }
    setBusy('set'); setFlash('');
    const { data, error } = await SB.functions.invoke('admin-set-reviewer-pin', {
      body: { email: r.email, display_name: r.display_name, title: r.title, pin },
    });
    setBusy('');
    if (error || data?.error) { setFlash(`Failed: ${data?.error || error.message}`); return; }
    setPin('');
    setFlash(data.must_change_password
      ? 'PIN set ✓ — reviewer must still set their own password before they can review.'
      : 'PIN set ✓');
    onDone();
  }

  async function removePin() {
    if (!confirm(`Remove ${r.display_name}'s PIN? They will not be able to sign in until you set a new one.`)) return;
    setBusy('clear'); setFlash('');
    const { data, error } = await SB.functions.invoke('admin-clear-reviewer-pin', { body: { email: r.email } });
    setBusy('');
    if (error || data?.error) { setFlash(`Failed: ${data?.error || error.message}`); return; }
    setFlash('PIN removed.');
    onDone();
  }

  async function toggleActive() {
    setBusy('active'); setFlash('');
    const { error } = await SB.from('email_reviewers').update({ active: !r.active }).eq('email', r.email);
    setBusy('');
    if (error) { setFlash(`Failed: ${error.message}`); return; }
    onDone();
  }

  return (
    <div style={{ border: `1px solid ${open ? P.hairStrong : P.hair}`, borderLeft: `3px solid ${r.active ? P.gold : P.faint}`, background: P.navy }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer',
          padding: `${sp[3]}px ${sp[4]}px`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: sp[3],
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: mono, fontSize: fs.sm, color: P.cream }}>
            {r.display_name} {r.title && <span style={{ color: P.mute }}>· {r.title}</span>}
          </div>
          <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, marginTop: 2 }}>{r.email}</div>
        </div>
        <div style={{ display: 'flex', gap: sp[1], flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!r.active && <Badge tone="mute">inactive</Badge>}
          {locked && <Badge tone="red">locked {fmtTime(r.pin_locked_until)}</Badge>}
          {r.has_pin === true && <Badge tone="green">PIN set</Badge>}
          {r.has_pin === false && <Badge tone="gold">no PIN</Badge>}
          {r.must_change_password && <Badge tone="gold">needs password</Badge>}
        </div>
      </button>

      {open && (
        <div style={{ padding: `0 ${sp[4]}px ${sp[4]}px`, borderTop: `1px solid ${P.hair}` }}>
          <div style={{ marginTop: sp[3], display: 'flex', gap: sp[2], alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <Label>SET / RESET 4-DIGIT PIN</Label>
              <Input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                inputMode="numeric"
                style={{ letterSpacing: '0.5em', textAlign: 'center' }}
              />
            </div>
            <Btn size="sm" variant="gold" disabled={busy === 'set'} onClick={setPinNow}>{busy === 'set' ? 'SAVING…' : 'SET PIN'}</Btn>
          </div>

          <div style={{ marginTop: sp[3], display: 'flex', gap: sp[2], flexWrap: 'wrap' }}>
            {r.has_pin !== false && (
              <Btn size="sm" variant="ghost" disabled={busy === 'clear'} onClick={removePin}>
                {busy === 'clear' ? 'REMOVING…' : locked ? 'CLEAR PIN + LOCKOUT' : 'REMOVE PIN'}
              </Btn>
            )}
            <Btn size="sm" variant="ghost" disabled={busy === 'active'} onClick={toggleActive}>
              {busy === 'active' ? '…' : r.active ? 'DEACTIVATE' : 'REACTIVATE'}
            </Btn>
          </div>

          {r.must_change_password && (
            <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, marginTop: sp[3] }}>
              This account is still on a dashboard temp password. The reviewer must sign in with the password once and set
              their own before <code>is_reviewer()</code> lets them do anything — a PIN alone will not clear this.
            </div>
          )}
          {flash && <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: sp[3] }}>{flash}</div>}
        </div>
      )}
    </div>
  );
}

function AddReviewer({ onDone }) {
  const [f, setF] = useState({ display_name: '', email: '', title: '', pin: '' });
  const [activateNow, setActivateNow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  async function submit() {
    if (!f.display_name.trim() || !f.email.trim()) { setFlash('Name and email are required.'); return; }
    if (!/^\d{4}$/.test(f.pin)) { setFlash('PIN must be exactly 4 digits.'); return; }
    setBusy(true); setFlash('');
    const { data, error } = await SB.functions.invoke('admin-set-reviewer-pin', {
      body: {
        email: f.email.trim(),
        display_name: f.display_name.trim(),
        title: f.title.trim() || null,
        pin: f.pin,
        activate_now: activateNow,
      },
    });
    setBusy(false);
    if (error || data?.error) { setFlash(`Failed: ${data?.error || error.message}`); return; }
    setF({ display_name: '', email: '', title: '', pin: '' });
    setActivateNow(false);
    setFlash(data.must_change_password
      ? 'Added ✓ — reviewer must set their own password on first sign-in.'
      : 'Added ✓');
    onDone();
  }

  return (
    <div>
      <Label>ADD REVIEWER ACCOUNT</Label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: sp[2], marginBottom: sp[2] }}>
        <Input value={f.display_name} onChange={(e) => set('display_name', e.target.value)} placeholder="Display name" />
        <Input value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="name@hcde.org" />
        <Input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Title (SAI, Sgt Kaz, 1SG…)" />
        <Input
          value={f.pin}
          onChange={(e) => set('pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="4-digit PIN"
          inputMode="numeric"
          style={{ letterSpacing: '0.5em', textAlign: 'center' }}
        />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: sp[2], fontFamily: mono, fontSize: fs.xs, color: P.mute, marginBottom: sp[3], cursor: 'pointer' }}>
        <input type="checkbox" checked={activateNow} onChange={(e) => setActivateNow(e.target.checked)} />
        Password already set in the Supabase dashboard — skip the forced first-login change
      </label>
      <Btn size="sm" variant="gold" disabled={busy} onClick={submit}>{busy ? 'ADDING…' : 'ADD ACCOUNT'}</Btn>
      {flash && <span style={{ fontFamily: mono, fontSize: 12, color: P.mute, marginLeft: sp[3] }}>{flash}</span>}
    </div>
  );
}
