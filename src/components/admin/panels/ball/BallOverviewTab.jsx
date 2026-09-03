import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, sp, fs } from '../../theme';
import { Btn, Input } from '../../shared/ui';

// S-6 full-visibility overview of the Military Ball. S-6 has FOR ALL RLS on
// ball_signups / ball_guests (ball_signups_all_s6 / ball_guests_all_s6) and
// bypasses the column-guard trigger entirely (is_s6() returns NEW immediately),
// so this reads AND edits/deletes the base rows directly — every column, both
// populations — where the ops / dress / attire portals each see only their
// RLS-scoped view.
//
// Edit / Delete here are the S-6 override: fix a bad signup, remove a test or
// duplicate. Routine flips (cash, form, dress, allergy status) still have their
// own purpose-built surfaces at /ball/ops, /ball/dress, /ball/attire and the
// S-5 Ball Allergies panel — but S-6 can also do them from the edit form.

const money = (n) => (n == null ? '—' : `$${Number(n).toFixed(Number.isInteger(Number(n)) ? 0 : 2)}`);
const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const numOrNull = (v) => (v === '' || v == null ? null : Number(v));

function Chip({ children, tone = 'mute' }) {
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

function Field({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.12em', color: P.faint, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.cream, wordBreak: 'break-word' }}>{value ?? '—'}</div>
    </div>
  );
}

// --- edit primitives ---------------------------------------------------------
const inputSm = { fontSize: fs.xs, padding: '7px 9px' };

function ELabel({ children }) {
  return <div style={{ fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.12em', color: P.gold, textTransform: 'uppercase', marginBottom: 3 }}>{children}</div>;
}
function EText({ label, value, onChange, ...rest }) {
  return (
    <div style={{ minWidth: 0 }}>
      <ELabel>{label}</ELabel>
      <Input value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={inputSm} {...rest} />
    </div>
  );
}
function ESelect({ label, value, onChange, options }) {
  return (
    <div style={{ minWidth: 0 }}>
      <ELabel>{label}</ELabel>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        style={{
          width: '100%', boxSizing: 'border-box', background: P.deep, border: `1px solid ${P.hair}`,
          color: P.cream, fontFamily: mono, fontSize: fs.xs, padding: '7px 9px', borderRadius: 5,
        }}
      >
        {options.map((o) => <option key={String(o.value)} value={o.value ?? ''}>{o.label}</option>)}
      </select>
    </div>
  );
}
function ECheck({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: sp[2], fontFamily: mono, fontSize: fs.xs, color: P.cream, cursor: 'pointer', minWidth: 0 }}>
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

// ---------------------------------------------------------------------------

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

  if (signups === null) return <div style={{ fontFamily: mono, fontSize: 13, color: P.mute }}>LOADING…</div>;

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', gap: sp[2], flexWrap: 'wrap', marginBottom: sp[4] }}>
        <StatPill n={stats.total} label="signups" />
        <StatPill n={stats.verified} label="fully verified" tone="green" />
        <StatPill n={stats.awaiting} label="awaiting guest" />
        <StatPill n={stats.cashOut} label="cash outstanding" tone={stats.cashOut ? 'gold' : 'mute'} />
        <StatPill n={stats.formOut} label="field-trip form outstanding" tone={stats.formOut ? 'gold' : 'mute'} />
        <StatPill n={stats.allergies} label="allergy flags" />
        <Btn size="sm" variant="ghost" onClick={load} style={{ marginLeft: 'auto' }}>REFRESH</Btn>
      </div>

      {signups.length > 6 && (
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cadet, guest, or email…" style={{ marginBottom: sp[4] }} />
      )}

      {err && <div style={{ fontFamily: mono, fontSize: 12, color: P.red, marginBottom: sp[3] }}>{err}</div>}

      {signups.length === 0 ? (
        <div style={{ fontFamily: mono, fontSize: 13, color: P.mute, border: `1px dashed ${P.hairStrong}`, padding: sp[5], textAlign: 'center' }}>
          No ball signups yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2] }}>
          {list.map((r) => (
            <SignupRow
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

      <div style={{ fontFamily: mono, fontSize: 11, color: P.faint, marginTop: sp[4] }}>
        Expand a row to edit any field or delete the signup (guest cascades). Routine flips also live at /ball/ops, /ball/dress, /ball/attire and the Ball Allergies panel.
      </div>
    </div>
  );
}

function StatPill({ n, label, tone = 'mute' }) {
  const c = { gold: P.gold, green: P.green, mute: P.mute }[tone] || P.mute;
  const lit = tone !== 'mute';
  return (
    <span style={{
      fontFamily: mono, fontSize: fs.xs, letterSpacing: '0.06em', padding: '6px 12px',
      border: `1px solid ${lit ? c : P.hair}`, background: lit ? P.goldWash : 'transparent', color: lit ? c : P.mute,
    }}>
      <b style={{ color: lit ? c : P.cream }}>{n}</b> {label}
    </span>
  );
}

function SignupRow({ r, guest, open, onToggle, onChanged }) {
  const [editing, setEditing] = useState(false);
  const verified = r.status === 'fully_verified';
  const cashDone = r.cash_received;
  const formNeeded = r.field_trip_form_required;
  const formDone = !formNeeded || r.field_trip_form_received;
  const settled = verified && cashDone && formDone;

  return (
    <div style={{
      border: `1px solid ${open ? P.hairStrong : P.hair}`,
      borderLeft: `3px solid ${settled ? P.green : verified ? P.gold : P.hair}`,
      background: P.navy,
    }}>
      <button
        onClick={() => { if (open) setEditing(false); onToggle(); }}
        style={{
          width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer',
          padding: `${sp[3]}px ${sp[4]}px`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: sp[3],
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: mono, fontSize: fs.sm, color: P.cream }}>
            {r.cadet_name}
            {guest && <span style={{ color: P.mute }}> + {guest.name}</span>}
          </div>
          <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, marginTop: 2 }}>
            LET {r.cadet_let_level || '--'} · {(r.cadet_company || '—').toUpperCase()} · {r.cadet_gender || '—'} · signed up {fmt(r.created_at)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: sp[1], flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Chip tone={verified ? 'green' : 'mute'}>{verified ? 'verified' : 'awaiting guest'}</Chip>
          <Chip tone={cashDone ? 'green' : 'gold'}>{cashDone ? 'paid' : `owes ${money(r.amount_due)}`}</Chip>
          {formNeeded && <Chip tone={r.field_trip_form_received ? 'green' : 'gold'}>{r.field_trip_form_received ? 'form in' : 'form out'}</Chip>}
          {r.cadet_has_allergy && <Chip tone={r.allergy_status === 'contacted' ? 'green' : 'red'}>allergy</Chip>}
        </div>
      </button>

      {open && !editing && (
        <div style={{ padding: `${sp[3]}px ${sp[4]}px ${sp[4]}px`, borderTop: `1px solid ${P.hair}`, display: 'flex', flexDirection: 'column', gap: sp[4] }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.16em', color: P.gold, textTransform: 'uppercase', marginBottom: sp[2] }}>Cadet</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: sp[3] }}>
              <Field label="School email" value={r.cadet_school_email} />
              <Field label="Notify email" value={r.notification_email} />
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
              <div style={{ fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.16em', color: P.gold, textTransform: 'uppercase', marginBottom: sp[2] }}>
                Guest — {guest.guest_type || 'date'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: sp[3] }}>
                <Field label="Name" value={guest.name} />
                <Field label="Age" value={guest.age} />
                <Field label="Gender" value={guest.gender} />
                <Field label="Personal email" value={guest.personal_email} />
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
            <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute }}>Solo — no guest on this signup.</div>
          )}

          <div style={{ display: 'flex', gap: sp[2] }}>
            <Btn size="sm" variant="ghost" onClick={() => setEditing(true)}>EDIT INFO</Btn>
            <DeleteButton r={r} guest={guest} onChanged={onChanged} />
          </div>
        </div>
      )}

      {open && editing && (
        <EditForm r={r} guest={guest} onDone={(changed) => { setEditing(false); if (changed) onChanged(); }} />
      )}
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
      <Btn size="sm" variant="danger" disabled={busy} onClick={del}>{busy ? 'DELETING…' : 'DELETE SIGNUP'}</Btn>
      {err && <span style={{ fontFamily: mono, fontSize: 11, color: P.red, alignSelf: 'center' }}>{err}</span>}
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
    <div style={{ padding: `${sp[3]}px ${sp[4]}px ${sp[4]}px`, borderTop: `1px solid ${P.hair}`, display: 'flex', flexDirection: 'column', gap: sp[4] }}>
      <div>
        <div style={{ fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.16em', color: P.gold, textTransform: 'uppercase', marginBottom: sp[2] }}>Edit cadet</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: sp[3] }}>
          <EText label="Cadet name" value={s.cadet_name} onChange={(v) => setSF('cadet_name', v)} />
          <EText label="LET level" value={s.cadet_let_level} onChange={(v) => setSF('cadet_let_level', v)} />
          <EText label="Company" value={s.cadet_company} onChange={(v) => setSF('cadet_company', v)} />
          <EText label="Age" value={s.cadet_age} onChange={(v) => setSF('cadet_age', v)} inputMode="numeric" />
          <ESelect label="Gender" value={s.cadet_gender} onChange={(v) => setSF('cadet_gender', v)} options={GENDER_OPTS} />
          <EText label="Notify email" value={s.notification_email} onChange={(v) => setSF('notification_email', v)} />
          <ESelect label="Status" value={s.status} onChange={(v) => setSF('status', v)} options={STATUS_OPTS} />
          <EText label="Amount due ($)" value={s.amount_due} onChange={(v) => setSF('amount_due', v)} inputMode="decimal" />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: sp[4], marginTop: sp[3] }}>
          <ECheck label="Field trip form required" checked={s.field_trip_form_required} onChange={(v) => setSF('field_trip_form_required', v)} />
          <ECheck label="Field trip form received" checked={s.field_trip_form_received} onChange={(v) => setSF('field_trip_form_received', v)} />
          <ECheck label="Cash received" checked={s.cash_received} onChange={(v) => setSF('cash_received', v)} />
          <ECheck label="Dress approved" checked={s.dress_approved} onChange={(v) => setSF('dress_approved', v)} />
          <ECheck label="Has allergy" checked={s.cadet_has_allergy} onChange={(v) => setSF('cadet_has_allergy', v)} />
        </div>
        {s.cadet_has_allergy && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: sp[3], marginTop: sp[3] }}>
            <EText label="Allergy email" value={s.cadet_allergy_email} onChange={(v) => setSF('cadet_allergy_email', v)} />
            <ESelect label="Allergy status" value={s.allergy_status} onChange={(v) => setSF('allergy_status', v)} options={ALLERGY_OPTS} />
          </div>
        )}
      </div>

      {g && (
        <div>
          <div style={{ fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.16em', color: P.gold, textTransform: 'uppercase', marginBottom: sp[2] }}>Edit guest</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: sp[3] }}>
            <EText label="Guest name" value={g.name} onChange={(v) => setGF('name', v)} />
            <EText label="Age" value={g.age} onChange={(v) => setGF('age', v)} inputMode="numeric" />
            <ESelect label="Gender" value={g.gender} onChange={(v) => setGF('gender', v)} options={GENDER_OPTS} />
            <ESelect label="Guest type" value={g.guest_type} onChange={(v) => setGF('guest_type', v)} options={GTYPE_OPTS} />
            <EText label="Personal email" value={g.personal_email} onChange={(v) => setGF('personal_email', v)} />
            <EText label="School attended" value={g.school_attended} onChange={(v) => setGF('school_attended', v)} />
            <EText label="POC name" value={g.poc_name} onChange={(v) => setGF('poc_name', v)} />
            <EText label="POC email" value={g.poc_email} onChange={(v) => setGF('poc_email', v)} />
            <EText label="POC phone" value={g.poc_phone} onChange={(v) => setGF('poc_phone', v)} />
            {g.guest_type === 'friend' && <EText label="Friend owes ($)" value={g.friend_amount_due} onChange={(v) => setGF('friend_amount_due', v)} inputMode="decimal" />}
            {g.guest_type === 'friend' && <ESelect label="Friend pays via" value={g.friend_payment_method} onChange={(v) => setGF('friend_payment_method', v)} options={FPAY_OPTS} />}
          </div>
          <div style={{ marginTop: sp[3] }}>
            <ECheck label="Guest dress approved" checked={g.dress_approved} onChange={(v) => setGF('dress_approved', v)} />
          </div>
        </div>
      )}

      {err && <div style={{ fontFamily: mono, fontSize: 12, color: P.red }}>{err}</div>}
      <div style={{ display: 'flex', gap: sp[2] }}>
        <Btn size="sm" variant="gold" disabled={busy} onClick={save}>{busy ? 'SAVING…' : 'SAVE CHANGES'}</Btn>
        <Btn size="sm" variant="ghost" disabled={busy} onClick={() => onDone(false)}>CANCEL</Btn>
      </div>
      <div style={{ fontFamily: mono, fontSize: 11, color: P.faint }}>
        S-6 write — bypasses the column guard. Friend-only fields save as null when guest type is "date".
      </div>
    </div>
  );
}
