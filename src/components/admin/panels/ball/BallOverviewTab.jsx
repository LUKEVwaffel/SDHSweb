import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import '../../../review/review.css';
import '../../../ball/portal.css';

// S-6 full-visibility overview of the Military Ball. Deliberately built on the
// warm-paper review/portal CSS (.rv / .bp-*), NOT the dark DISPATCH theme —
// same look as /ball/ops so it reads as a simple portal, not a dense admin
// panel. S-6 has FOR ALL RLS on ball_signups / ball_guests and bypasses the
// column-guard trigger, so this reads AND edits/deletes the base rows directly.

const money = (n) => (n == null ? '—' : `$${Number(n).toFixed(Number.isInteger(Number(n)) ? 0 : 2)}`);
const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const numOrNull = (v) => (v === '' || v == null ? null : Number(v));

// Embedded warm-paper surface — .rv owns the palette + fonts; drop its
// full-screen layout so it sits inside the DISPATCH content area.
const RV_EMBED = { minHeight: 'auto', margin: 0, borderRadius: 12, overflow: 'hidden' };
const SHELL = { maxWidth: 'none', margin: 0, padding: '26px 24px 34px' };

const chip = (tone) => {
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

const lbl = { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--rv-faint)', marginBottom: 3 };
const val = { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--rv-ink)', wordBreak: 'break-word' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 };
const groupHead = { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--rv-accent)', margin: '0 0 8px' };
const detailWrap = { padding: '14px 16px 16px', borderTop: '1px solid var(--rv-border)', display: 'flex', flexDirection: 'column', gap: 16 };

function Field({ label, value }) {
  return <div style={{ minWidth: 0 }}><div style={lbl}>{label}</div><div style={val}>{value ?? '—'}</div></div>;
}

// --- edit primitives -------------------------------------------------------
const editSelect = {
  width: '100%', boxSizing: 'border-box', border: '1px solid var(--rv-border-strong)',
  borderRadius: 8, padding: '9px 11px', fontSize: 13, fontFamily: 'inherit',
  color: 'var(--rv-ink)', background: '#fffefb',
};
function ELabel({ children }) {
  return <div style={{ ...lbl, color: 'var(--rv-mute)', marginBottom: 6 }}>{children}</div>;
}
function EText({ label, value, onChange, ...rest }) {
  return (
    <div style={{ minWidth: 0 }}>
      <ELabel>{label}</ELabel>
      <input className="rv-textarea" value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={{ padding: '9px 11px', fontSize: 13 }} {...rest} />
    </div>
  );
}
function ESelect({ label, value, onChange, options }) {
  return (
    <div style={{ minWidth: 0 }}>
      <ELabel>{label}</ELabel>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} style={editSelect}>
        {options.map((o) => <option key={String(o.value)} value={o.value ?? ''}>{o.label}</option>)}
      </select>
    </div>
  );
}
function ECheck({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--rv-ink)', cursor: 'pointer' }}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

const GENDER_OPTS = [{ value: null, label: '—' }, { value: 'male', label: 'male' }, { value: 'female', label: 'female' }];
const STATUS_OPTS = [{ value: 'guest_pending', label: 'guest_pending' }, { value: 'fully_verified', label: 'fully_verified' }];
const ALLERGY_OPTS = [{ value: 'pending', label: 'pending' }, { value: 'contacted', label: 'contacted' }];
const GTYPE_OPTS = [{ value: 'date', label: 'date' }, { value: 'friend', label: 'friend' }];
const FPAY_OPTS = [{ value: null, label: '—' }, { value: 'host_delivers', label: 'host brings it' }, { value: 'self_pays', label: 'friend pays direct' }];

// ------------------------------------------------------------------------

export default function BallOverviewTab() {
  const [signups, setSignups] = useState(null);
  const [guestBySignup, setGuestBySignup] = useState({});
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    const [{ data: s, error: sErr }, { data: g, error: gErr }] = await Promise.all([
      SB.from('ball_signups').select('*').order('created_at', { ascending: false }),
      SB.from('ball_guests').select('*'),
    ]);
    if (sErr || gErr) { setErr((sErr || gErr).message); setSignups([]); return; }
    setErr('');
    const by = {};
    (g || []).forEach((row) => { by[row.signup_id] = row; });
    setGuestBySignup(by);
    setSignups(s || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const { list, stats } = useMemo(() => {
    const rows = signups || [];
    const term = q.trim().toLowerCase();
    const match = (r) => {
      if (!term) return true;
      const guest = guestBySignup[r.id];
      return (r.cadet_name || '').toLowerCase().includes(term)
        || (r.cadet_school_email || '').toLowerCase().includes(term)
        || (guest?.name || '').toLowerCase().includes(term);
    };
    const filtered = rows.filter(match);
    const verified = rows.filter((r) => r.status === 'fully_verified');
    return {
      list: filtered,
      stats: {
        total: rows.length,
        verified: verified.length,
        awaiting: rows.filter((r) => r.status === 'guest_pending').length,
        cashOut: verified.filter((r) => !r.cash_received).length,
        formOut: verified.filter((r) => r.field_trip_form_required && !r.field_trip_form_received).length,
        allergies: rows.filter((r) => r.cadet_has_allergy).length,
      },
    };
  }, [signups, guestBySignup, q]);

  if (signups === null) {
    return (
      <div className="rv" style={RV_EMBED}><div className="rv-shell" style={SHELL}>
        <p className="rv-sub"><span className="rv-dot" />Loading signups&hellip;</p>
      </div></div>
    );
  }

  return (
    <div className="rv" style={RV_EMBED}>
      <div className="rv-shell" style={SHELL}>
        <div className="bp-head">
          <h1 className="bp-title">Ball Signups</h1>
          <button className="bp-refresh" onClick={load}>Refresh</button>
        </div>

        <div className="bp-stats">
          <span className="bp-stat"><b>{stats.total}</b> signups</span>
          <span className={`bp-stat ${stats.verified ? 'is-done' : ''}`}><b>{stats.verified}</b> verified</span>
          <span className="bp-stat"><b>{stats.awaiting}</b> awaiting guest</span>
          <span className={`bp-stat ${stats.cashOut ? 'is-alert' : ''}`}><b>{stats.cashOut}</b> cash outstanding</span>
          <span className={`bp-stat ${stats.formOut ? 'is-alert' : ''}`}><b>{stats.formOut}</b> form outstanding</span>
          <span className="bp-stat"><b>{stats.allergies}</b> allergy flags</span>
        </div>

        {signups.length > 6 && (
          <input className="bp-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cadet, guest, or email…" />
        )}

        {err && <div className="rv-flash">{err}</div>}

        {signups.length === 0 ? (
          <div className="bp-empty">No ball signups yet.</div>
        ) : (
          <div className="rv-list">
            {list.map((r) => (
              <SignupItem
                key={r.id}
                r={r}
                guest={guestBySignup[r.id]}
                open={openId === r.id}
                onToggle={() => setOpenId(openId === r.id ? null : r.id)}
                onChanged={load}
              />
            ))}
          </div>
        )}

        <p className="rv-sub" style={{ fontSize: 12, marginTop: 18 }}>
          Open a row to edit any field or delete the signup (guest cascades). Routine flips also live at /ball/ops, /ball/dress, /ball/attire and the Ball Allergies panel.
        </p>
      </div>
    </div>
  );
}

function SignupItem({ r, guest, open, onToggle, onChanged }) {
  const [editing, setEditing] = useState(false);
  const verified = r.status === 'fully_verified';
  const cashDone = r.cash_received;
  const formNeeded = r.field_trip_form_required;
  const formDone = !formNeeded || r.field_trip_form_received;
  const settled = verified && cashDone && formDone;

  return (
    <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderLeft: `3px solid ${settled ? 'var(--rv-green)' : verified ? 'var(--rv-accent)' : 'var(--rv-faint)'}`, borderRadius: 'var(--rv-radius)', overflow: 'hidden' }}>
      <button
        onClick={() => { if (open) setEditing(false); onToggle(); }}
        style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--rv-ink)' }}>
            {r.cadet_name}{guest && <span style={{ color: 'var(--rv-mute)', fontWeight: 400 }}> + {guest.name}</span>}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--rv-mute)', marginTop: 4 }}>
            LET {r.cadet_let_level || '--'} · {(r.cadet_company || '—').toUpperCase()} · {r.cadet_gender || '—'} · {fmt(r.created_at)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={chip(verified ? 'green' : 'mute')}>{verified ? 'verified' : 'awaiting guest'}</span>
          <span style={chip(cashDone ? 'green' : 'accent')}>{cashDone ? 'paid' : `owes ${money(r.amount_due)}`}</span>
          {formNeeded && <span style={chip(r.field_trip_form_received ? 'green' : 'accent')}>{r.field_trip_form_received ? 'form in' : 'form out'}</span>}
          {r.cadet_has_allergy && <span style={chip(r.allergy_status === 'contacted' ? 'green' : 'red')}>allergy</span>}
        </div>
      </button>

      {open && !editing && (
        <div style={detailWrap}>
          <div>
            <div style={groupHead}>Cadet</div>
            <div style={grid}>
              <Field label="School email" value={r.cadet_school_email} />
              <Field label="Notify email" value={r.notification_email} />
              <Field label="Phone" value={r.cadet_phone} />
              <Field label="Age" value={r.cadet_age} />
              <Field label="Amount due" value={money(r.amount_due)} />
              <Field label="Cash received" value={r.cash_received ? 'yes' : 'no'} />
              <Field label="Field-trip form" value={!r.field_trip_form_required ? 'not required' : r.field_trip_form_received ? 'received' : 'outstanding'} />
              <Field label="Dress approved" value={r.dress_approved == null ? 'n/a' : r.dress_approved ? `yes — ${r.dress_approved_by?.split('@')[0] || ''}` : 'no'} />
              <Field label="Allergy" value={!r.cadet_has_allergy ? 'none flagged' : `${r.allergy_status}${r.allergy_contacted_at ? ` ${fmt(r.allergy_contacted_at)}` : ''}`} />
              {r.cadet_has_allergy && <Field label="Allergy email" value={r.cadet_allergy_email} />}
              {r.cadet_allergies && <Field label="Allergy notes (legacy)" value={r.cadet_allergies} />}
            </div>
          </div>

          {guest ? (
            <div>
              <div style={groupHead}>Guest — {guest.guest_type || 'date'}</div>
              <div style={grid}>
                <Field label="Name" value={guest.name} />
                <Field label="Age" value={guest.age} />
                <Field label="Gender" value={guest.gender} />
                <Field label="Personal email" value={guest.personal_email} />
                <Field label="Guest phone" value={guest.guest_phone} />
                <Field label="SDHS JROTC" value={guest.is_sdhs_jrotc ? 'yes' : 'no'} />
                <Field label="School attended" value={guest.school_attended} />
                {guest.other_jrotc && <Field label="Other JROTC" value={guest.other_jrotc_school || 'yes'} />}
                {guest.guest_type === 'friend' && <Field label="Friend owes" value={money(guest.friend_amount_due)} />}
                {guest.guest_type === 'friend' && <Field label="Friend pays via" value={guest.friend_payment_method === 'host_delivers' ? 'host brings it' : 'friend pays direct'} />}
                <Field label="POC" value={guest.poc_name} />
                <Field label="POC email" value={guest.poc_email} />
                <Field label="POC phone" value={guest.poc_phone} />
                <Field label="Dress approved" value={guest.dress_approved == null ? 'n/a' : guest.dress_approved ? `yes — ${guest.dress_approved_by?.split('@')[0] || ''}` : 'no'} />
                <Field label="Dress code accepted" value={fmt(guest.dress_code_accepted_at)} />
                <Field label="Verified" value={fmt(guest.verified_at)} />
                {guest.allergies && <Field label="Guest allergies" value={guest.allergies} />}
              </div>
            </div>
          ) : (
            <div className="rv-sub" style={{ fontSize: 13 }}>Solo — no guest on this signup.</div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="rv-btn ghost" onClick={() => setEditing(true)}>Edit info</button>
            <DeleteButton r={r} guest={guest} onChanged={onChanged} />
          </div>
        </div>
      )}

      {open && editing && <EditForm r={r} guest={guest} onDone={(changed) => { setEditing(false); if (changed) onChanged(); }} />}
    </div>
  );
}

function DeleteButton({ r, guest, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function del() {
    if (!confirm(`Delete ${r.cadet_name}'s signup${guest ? ` and guest ${guest.name}` : ''}? This cannot be undone.`)) return;
    setBusy(true); setErr('');
    // ball_guests has ON DELETE CASCADE from ball_signups — one delete clears both.
    const { error } = await SB.from('ball_signups').delete().eq('id', r.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onChanged();
  }

  return (
    <>
      <button className="rv-btn deny" disabled={busy} onClick={del}>{busy ? 'Deleting…' : 'Delete signup'}</button>
      {err && <span className="rv-flash" style={{ margin: 0 }}>{err}</span>}
    </>
  );
}

function EditForm({ r, guest, onDone }) {
  const [s, setS] = useState({
    cadet_name: r.cadet_name || '',
    cadet_let_level: r.cadet_let_level || '',
    cadet_company: r.cadet_company || '',
    cadet_age: r.cadet_age ?? '',
    cadet_gender: r.cadet_gender || null,
    cadet_phone: r.cadet_phone || '',
    notification_email: r.notification_email || '',
    status: r.status || 'guest_pending',
    amount_due: r.amount_due ?? '',
    field_trip_form_required: r.field_trip_form_required,
    field_trip_form_received: r.field_trip_form_received,
    cash_received: r.cash_received,
    dress_approved: r.dress_approved,
    cadet_has_allergy: r.cadet_has_allergy,
    cadet_allergy_email: r.cadet_allergy_email || '',
    allergy_status: r.allergy_status || 'pending',
  });
  const [g, setG] = useState(guest ? {
    name: guest.name || '',
    age: guest.age ?? '',
    gender: guest.gender || null,
    guest_type: guest.guest_type || 'date',
    personal_email: guest.personal_email || '',
    guest_phone: guest.guest_phone || '',
    school_attended: guest.school_attended || '',
    poc_name: guest.poc_name || '',
    poc_email: guest.poc_email || '',
    poc_phone: guest.poc_phone || '',
    friend_amount_due: guest.friend_amount_due ?? '',
    friend_payment_method: guest.friend_payment_method || null,
    dress_approved: guest.dress_approved,
  } : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const setSF = (k, v) => setS((o) => ({ ...o, [k]: v }));
  const setGF = (k, v) => setG((o) => ({ ...o, [k]: v }));

  async function save() {
    setBusy(true); setErr('');
    const sPatch = {
      cadet_name: s.cadet_name.trim(),
      cadet_let_level: s.cadet_let_level.trim() || null,
      cadet_company: s.cadet_company.trim() || null,
      cadet_age: numOrNull(s.cadet_age),
      cadet_gender: s.cadet_gender || null,
      cadet_phone: s.cadet_phone.trim() || null,
      notification_email: s.notification_email.trim() || null,
      status: s.status,
      amount_due: numOrNull(s.amount_due),
      field_trip_form_required: !!s.field_trip_form_required,
      field_trip_form_received: !!s.field_trip_form_received,
      cash_received: !!s.cash_received,
      dress_approved: s.dress_approved,
      cadet_has_allergy: !!s.cadet_has_allergy,
      cadet_allergy_email: s.cadet_allergy_email.trim() || null,
      allergy_status: s.allergy_status,
    };
    const { error: e1 } = await SB.from('ball_signups').update(sPatch).eq('id', r.id);
    let e2 = null;
    if (g && guest) {
      const gPatch = {
        name: g.name.trim(),
        age: numOrNull(g.age),
        gender: g.gender || null,
        guest_type: g.guest_type,
        personal_email: g.personal_email.trim(),
        guest_phone: g.guest_phone.trim() || null,
        school_attended: g.school_attended.trim() || null,
        poc_name: g.poc_name.trim() || null,
        poc_email: g.poc_email.trim() || null,
        poc_phone: g.poc_phone.trim() || null,
        friend_amount_due: g.guest_type === 'friend' ? numOrNull(g.friend_amount_due) : null,
        friend_payment_method: g.guest_type === 'friend' ? g.friend_payment_method : null,
        dress_approved: g.dress_approved,
      };
      ({ error: e2 } = await SB.from('ball_guests').update(gPatch).eq('id', guest.id));
    }
    setBusy(false);
    if (e1 || e2) { setErr((e1 || e2).message); return; }
    onDone(true);
  }

  return (
    <div style={detailWrap}>
      <div>
        <div style={groupHead}>Edit cadet</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          <EText label="Cadet name" value={s.cadet_name} onChange={(v) => setSF('cadet_name', v)} />
          <EText label="LET level" value={s.cadet_let_level} onChange={(v) => setSF('cadet_let_level', v)} />
          <EText label="Company" value={s.cadet_company} onChange={(v) => setSF('cadet_company', v)} />
          <EText label="Age" value={s.cadet_age} onChange={(v) => setSF('cadet_age', v)} inputMode="numeric" />
          <ESelect label="Gender" value={s.cadet_gender} onChange={(v) => setSF('cadet_gender', v)} options={GENDER_OPTS} />
          <EText label="Notify email" value={s.notification_email} onChange={(v) => setSF('notification_email', v)} />
          <EText label="Phone" value={s.cadet_phone} onChange={(v) => setSF('cadet_phone', v)} inputMode="tel" />
          <ESelect label="Status" value={s.status} onChange={(v) => setSF('status', v)} options={STATUS_OPTS} />
          <EText label="Amount due ($)" value={s.amount_due} onChange={(v) => setSF('amount_due', v)} inputMode="decimal" />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12 }}>
          <ECheck label="Field trip form required" checked={s.field_trip_form_required} onChange={(v) => setSF('field_trip_form_required', v)} />
          <ECheck label="Field trip form received" checked={s.field_trip_form_received} onChange={(v) => setSF('field_trip_form_received', v)} />
          <ECheck label="Cash received" checked={s.cash_received} onChange={(v) => setSF('cash_received', v)} />
          <ECheck label="Dress approved" checked={s.dress_approved} onChange={(v) => setSF('dress_approved', v)} />
          <ECheck label="Has allergy" checked={s.cadet_has_allergy} onChange={(v) => setSF('cadet_has_allergy', v)} />
        </div>
        {s.cadet_has_allergy && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginTop: 12 }}>
            <EText label="Allergy email" value={s.cadet_allergy_email} onChange={(v) => setSF('cadet_allergy_email', v)} />
            <ESelect label="Allergy status" value={s.allergy_status} onChange={(v) => setSF('allergy_status', v)} options={ALLERGY_OPTS} />
          </div>
        )}
      </div>

      {g && (
        <div>
          <div style={groupHead}>Edit guest</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            <EText label="Guest name" value={g.name} onChange={(v) => setGF('name', v)} />
            <EText label="Age" value={g.age} onChange={(v) => setGF('age', v)} inputMode="numeric" />
            <ESelect label="Gender" value={g.gender} onChange={(v) => setGF('gender', v)} options={GENDER_OPTS} />
            <ESelect label="Guest type" value={g.guest_type} onChange={(v) => setGF('guest_type', v)} options={GTYPE_OPTS} />
            <EText label="Personal email" value={g.personal_email} onChange={(v) => setGF('personal_email', v)} />
            <EText label="Guest phone" value={g.guest_phone} onChange={(v) => setGF('guest_phone', v)} inputMode="tel" />
            <EText label="School attended" value={g.school_attended} onChange={(v) => setGF('school_attended', v)} />
            <EText label="POC name" value={g.poc_name} onChange={(v) => setGF('poc_name', v)} />
            <EText label="POC email" value={g.poc_email} onChange={(v) => setGF('poc_email', v)} />
            <EText label="POC phone" value={g.poc_phone} onChange={(v) => setGF('poc_phone', v)} />
            {g.guest_type === 'friend' && <EText label="Friend owes ($)" value={g.friend_amount_due} onChange={(v) => setGF('friend_amount_due', v)} inputMode="decimal" />}
            {g.guest_type === 'friend' && <ESelect label="Friend pays via" value={g.friend_payment_method} onChange={(v) => setGF('friend_payment_method', v)} options={FPAY_OPTS} />}
          </div>
          <div style={{ marginTop: 12 }}>
            <ECheck label="Guest dress approved" checked={g.dress_approved} onChange={(v) => setGF('dress_approved', v)} />
          </div>
        </div>
      )}

      {err && <div className="rv-flash" style={{ margin: 0 }}>{err}</div>}
      <div className="rv-actions" style={{ marginTop: 0 }}>
        <button className="rv-btn approve" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
        <button className="rv-btn ghost" disabled={busy} onClick={() => onDone(false)}>Cancel</button>
      </div>
      <p className="rv-sub" style={{ fontSize: 11, margin: 0 }}>
        S-6 write — bypasses the column guard. Friend-only fields save as null when guest type is “date”.
      </p>
    </div>
  );
}
