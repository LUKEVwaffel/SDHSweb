import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import '../../../review/review.css';
import '../../../ball/portal.css';

// S-6 provisioning for the review-portal accounts (Chief/SAI, Sgt Kaz).
// ONE login per person covers BOTH /review (DISPATCH email approvals) and
// /ball/ops (Military Ball payment tracking) — same email_reviewers population.
// Built on the warm-paper review CSS, not the dark DISPATCH theme, to match the
// portals it provisions.
//
// S-6 owns the roster (email_reviewers_admin_all RLS), so activate/deactivate
// is a plain write. PIN hash + lockout live in reviewer_credentials
// (service-role only) → the two s6-gated edge functions. reviewer_pin_status()
// (SECURITY DEFINER, is_s6 inside) is the only way S-6 sees PIN / lockout.

const RV_EMBED = { minHeight: 'auto', margin: 0, borderRadius: 12, overflow: 'hidden' };
const SHELL = { maxWidth: 'none', margin: 0, padding: '26px 24px 34px' };

const fmtTime = (d) => (d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

const badge = (tone) => {
  const map = {
    green: ['var(--rv-green)', 'var(--rv-green-soft)'],
    red: ['var(--rv-red)', 'var(--rv-red-soft)'],
    accent: ['var(--rv-accent)', 'var(--rv-accent-soft)'],
    mute: ['var(--rv-mute)', 'transparent'],
  };
  const [c, bg] = map[tone] || map.mute;
  return {
    fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.08em',
    textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999, color: c,
    background: bg, border: `1px solid ${c}`, whiteSpace: 'nowrap',
  };
};

const editInput = { padding: '9px 11px', fontSize: 13 };
const pinInput = { ...editInput, letterSpacing: '0.5em', textAlign: 'center' };
const detailWrap = { padding: '14px 16px 16px', borderTop: '1px solid var(--rv-border)', display: 'flex', flexDirection: 'column', gap: 14 };
const lbl = { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--rv-mute)', marginBottom: 6 };

export default function BallReviewerAccountsTab() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [statusFnMissing, setStatusFnMissing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await SB.rpc('reviewer_pin_status');
    if (error) {
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

  if (rows === null) {
    return (
      <div className="rv" style={RV_EMBED}><div className="rv-shell" style={SHELL}>
        <p className="rv-sub"><span className="rv-dot" />Loading accounts&hellip;</p>
      </div></div>
    );
  }

  return (
    <div className="rv" style={RV_EMBED}>
      <div className="rv-shell" style={SHELL}>
        <div className="bp-head">
          <h1 className="bp-title">Review Portal Accounts</h1>
          <button className="bp-refresh" onClick={load}>Refresh</button>
        </div>

        <p className="rv-sub" style={{ fontSize: 13, marginTop: 0 }}>
          One account per reviewer, used for BOTH the email review portal (<code>/review</code>) and Ball payments
          (<code>/ball/ops</code>). Each person must first exist as a Supabase Auth user (Dashboard → Authentication → Users).
        </p>

        {statusFnMissing && (
          <div className="rv-panel" style={{ padding: 14, marginBottom: 18 }}>
            <p className="rv-sub" style={{ margin: 0, fontSize: 12 }}>
              Run <b>supabase/reviewer_admin_pin_status.sql</b> to show PIN / lockout status per reviewer. Provisioning still works without it.
            </p>
          </div>
        )}
        {err && <div className="rv-flash">{err}</div>}

        <div className="rv-list" style={{ marginBottom: 28 }}>
          {rows.map((r) => <ReviewerItem key={r.email} r={r} onDone={load} />)}
          {rows.length === 0 && <div className="bp-empty">No reviewer accounts yet.</div>}
        </div>

        <div style={{ height: 1, background: 'var(--rv-border)', margin: '0 0 22px' }} />
        <AddReviewer onDone={load} />
      </div>
    </div>
  );
}

function ReviewerItem({ r, onDone }) {
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
      ? 'PIN set — reviewer must still set their own password before they can review.'
      : 'PIN set.');
    onDone();
  }

  async function removePin() {
    if (!confirm(`Remove ${r.display_name}'s PIN? They cannot sign in until you set a new one.`)) return;
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
    <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderLeft: `3px solid ${r.active ? 'var(--rv-accent)' : 'var(--rv-faint)'}`, borderRadius: 'var(--rv-radius)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--rv-ink)' }}>
            {r.display_name} {r.title && <span style={{ color: 'var(--rv-mute)', fontWeight: 400 }}>· {r.title}</span>}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--rv-mute)', marginTop: 4 }}>{r.email}</div>
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!r.active && <span style={badge('mute')}>inactive</span>}
          {locked && <span style={badge('red')}>locked {fmtTime(r.pin_locked_until)}</span>}
          {r.has_pin === true && <span style={badge('green')}>PIN set</span>}
          {r.has_pin === false && <span style={badge('accent')}>no PIN</span>}
          {r.must_change_password && <span style={badge('accent')}>needs password</span>}
        </div>
      </button>

      {open && (
        <div style={detailWrap}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={lbl}>Set / reset 4-digit PIN</div>
              <input
                className="rv-textarea" value={pin} inputMode="numeric" placeholder="••••"
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                style={pinInput}
              />
            </div>
            <button className="rv-btn approve" disabled={busy === 'set'} onClick={setPinNow}>{busy === 'set' ? 'Saving…' : 'Set PIN'}</button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {r.has_pin !== false && (
              <button className="rv-btn ghost" disabled={busy === 'clear'} onClick={removePin}>
                {busy === 'clear' ? 'Removing…' : locked ? 'Clear PIN + lockout' : 'Remove PIN'}
              </button>
            )}
            <button className="rv-btn ghost" disabled={busy === 'active'} onClick={toggleActive}>
              {busy === 'active' ? '…' : r.active ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>

          {r.must_change_password && (
            <p className="rv-sub" style={{ fontSize: 11, margin: 0, color: 'var(--rv-accent)' }}>
              Still on a dashboard temp password. The reviewer must sign in with the password once and set their own before
              <code> is_reviewer() </code> lets them do anything — a PIN alone will not clear this.
            </p>
          )}
          {flash && <p className="rv-sub" style={{ fontSize: 11, margin: 0 }}>{flash}</p>}
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
    setFlash(data.must_change_password ? 'Added — reviewer must set their own password on first sign-in.' : 'Added.');
    onDone();
  }

  return (
    <div>
      <div style={{ ...lbl, fontSize: 11, letterSpacing: '0.06em', color: 'var(--rv-mute)' }}>Add reviewer account</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 10 }}>
        <input className="rv-textarea" style={editInput} value={f.display_name} onChange={(e) => set('display_name', e.target.value)} placeholder="Display name" />
        <input className="rv-textarea" style={editInput} value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="name@hcde.org" />
        <input className="rv-textarea" style={editInput} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Title (SAI, Sgt Kaz…)" />
        <input className="rv-textarea" style={pinInput} value={f.pin} inputMode="numeric" onChange={(e) => set('pin', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="4-digit PIN" />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--rv-mute)', marginBottom: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={activateNow} onChange={(e) => setActivateNow(e.target.checked)} />
        Password already set in the Supabase dashboard — skip the forced first-login change
      </label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="rv-btn approve" disabled={busy} onClick={submit}>{busy ? 'Adding…' : 'Add account'}</button>
        {flash && <span className="rv-sub" style={{ fontSize: 12 }}>{flash}</span>}
      </div>
    </div>
  );
}
