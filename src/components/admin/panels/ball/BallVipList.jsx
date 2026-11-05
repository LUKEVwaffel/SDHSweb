import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { VIP_ROLE_LABELS as ROLE_LABEL } from '../../../../../supabase/functions/_shared/ballVipRoles.js';
import { grid, groupHead, detailWrap, Field, EText, ESelect, ECheck, GENDER_OPTS } from './ballEditFields';

// ball_vip_signups (visiting XO/BC/CSM + past King/Queen — see
// ball_vip_signup.sql), each with its optional ball_vip_dates row (King/Queen
// only). Self-reported, no approval gate. Click a VIP to see the full
// reservation and edit it, same as cadet signups in BallOverviewTab. S-6 has
// FOR ALL RLS on both tables and bypasses their column-guard triggers.
// Leadership signups that only said "XO/BC/CSM" (or the legacy "XO/BC") show
// as unidentified until S-6 pins them to one specific role.
const UNIDENTIFIED_ROLES = new Set(['visiting_leadership', 'visiting_xo_bc']);
const SPECIFIC_ROLES = ['visiting_csm', 'visiting_xo', 'visiting_bc'];
const isLeadership = (role) => UNIDENTIFIED_ROLES.has(role) || SPECIFIC_ROLES.includes(role);

const numOrNull = (v) => (v === '' || v == null ? null : Number(v));
const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const dressText = (x) => (x.dress_approved == null ? 'not recorded' : x.dress_approved ? `yes — ${x.dress_approved_by?.split('@')[0] || ''}` : 'no');

const chip = (done) => ({
  fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.08em',
  textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
  color: done ? 'var(--rv-green)' : 'var(--rv-accent)',
  background: done ? 'var(--rv-green-soft)' : 'var(--rv-accent-soft)',
  border: `1px solid ${done ? 'var(--rv-green)' : 'var(--rv-accent)'}`,
});

export default function BallVipList() {
  const [rows, setRows] = useState(null);
  const [datesBySignup, setDatesBySignup] = useState({});
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    const [{ data: v, error: vErr }, { data: d, error: dErr }] = await Promise.all([
      SB.from('ball_vip_signups').select('*').order('created_at', { ascending: false }),
      SB.from('ball_vip_dates').select('*'),
    ]);
    if (vErr || dErr) { setErr((vErr || dErr).message); return; }
    setErr('');
    setRows(v || []);
    setDatesBySignup(Object.fromEntries((d || []).map((x) => [x.vip_signup_id, x])));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setRole(row, role) {
    if (!role || role === row.role) return;
    setSavingId(row.id);
    setErr('');
    const { error } = await SB.from('ball_vip_signups').update({ role }).eq('id', row.id);
    setSavingId(null);
    if (error) { setErr(`Could not set role for ${row.name}: ${error.message}`); return; }
    setRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, role } : x)));
  }

  if (rows === null) return null;
  if (rows.length === 0 && !err) return null;

  const unidentifiedCount = rows.filter((r) => UNIDENTIFIED_ROLES.has(r.role)).length;

  return (
    <div style={{ marginTop: 22 }}>
      <div className="bp-head" style={{ marginBottom: 10 }}>
        <h2 className="bp-title" style={{ fontSize: 15 }}>Visiting Guests ({rows.length})</h2>
        <button className="bp-refresh" onClick={load}>Refresh</button>
      </div>
      <p className="rv-sub" style={{ fontSize: 12, marginBottom: 10 }}>
        Self-reported via /ball/vip &mdash; visiting XO/BC/CSM and past King/Queen (only a King/Queen may bring a date). Comped, no payment tracked here.
        Female dress approval is handled at /ball/dress, same queue as cadets/guests. Click a guest to view or edit their reservation.
      </p>
      {unidentifiedCount > 0 && (
        <div className="rv-flash" style={{ marginBottom: 10 }}>
          {unidentifiedCount} leadership {unidentifiedCount === 1 ? 'guest has' : 'guests have'} no specific role yet &mdash; pick CSM, XO or BC below.
        </div>
      )}
      {err && <div className="rv-flash">{err}</div>}
      <div className="rv-list">
        {rows.map((r) => (
          <VipItem
            key={r.id}
            r={r}
            date={datesBySignup[r.id]}
            open={openId === r.id}
            onToggle={() => setOpenId(openId === r.id ? null : r.id)}
            onRole={(role) => setRole(r, role)}
            roleSaving={savingId === r.id}
            onChanged={load}
          />
        ))}
      </div>
    </div>
  );
}

function VipItem({ r, date, open, onToggle, onRole, roleSaving, onChanged }) {
  const [editing, setEditing] = useState(false);
  const unidentified = UNIDENTIFIED_ROLES.has(r.role);
  const dressPending = (r.gender === 'female' && !r.dress_approved) || (date?.gender === 'female' && !date.dress_approved);

  return (
    <div style={{
      background: 'var(--rv-surface)', border: '1px solid var(--rv-border)',
      borderLeft: `3px solid ${unidentified ? 'var(--rv-accent)' : 'var(--rv-faint)'}`,
      borderRadius: 'var(--rv-radius)', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px 0 0' }}>
        <button
          onClick={() => { if (open) setEditing(false); onToggle(); }}
          aria-expanded={open}
          style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--rv-ink)' }}>
              {r.name}{date && <span style={{ color: 'var(--rv-mute)', fontWeight: 400 }}> + {date.name}</span>}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--rv-mute)', marginTop: 4 }}>
              {ROLE_LABEL[r.role] || r.role} · {r.home_school} · {r.gender || '—'} · {fmt(r.created_at)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {unidentified && <span style={chip(false)}>role unidentified</span>}
            {(r.gender === 'female' || date?.gender === 'female') && <span style={chip(!dressPending)}>{dressPending ? 'dress pending' : 'dress approved'}</span>}
            {(r.has_allergy) && <span style={chip(false)}>allergy</span>}
          </div>
        </button>
        {isLeadership(r.role) && (
          <select
            aria-label={`Leadership role for ${r.name}`}
            value={unidentified ? '' : r.role}
            disabled={roleSaving}
            onChange={(e) => onRole(e.target.value)}
            style={{ fontSize: 12 }}
          >
            {unidentified && <option value="" disabled>Who is this? (CSM / XO / BC)</option>}
            {SPECIFIC_ROLES.map((role) => (
              <option key={role} value={role}>{ROLE_LABEL[role]}</option>
            ))}
          </select>
        )}
      </div>

      {open && !editing && (
        <div style={detailWrap}>
          <div>
            <div style={groupHead}>VIP</div>
            <div style={grid}>
              <Field label="Role" value={ROLE_LABEL[r.role] || r.role} />
              <Field label="Home school" value={r.home_school} />
              <Field label="Personal email" value={r.personal_email} />
              <Field label="Phone" value={r.phone} />
              <Field label="Age" value={r.age} />
              <Field label="Gender" value={r.gender} />
              <Field label="Allergy" value={r.has_allergy ? (r.allergy_detail || 'yes') : 'none flagged'} />
              {r.gender === 'female' && <Field label="Dress approved" value={dressText(r)} />}
              <Field label="Dress code accepted" value={fmt(r.dress_code_accepted_at)} />
            </div>
          </div>
          {date ? (
            <div>
              <div style={groupHead}>Date</div>
              <div style={grid}>
                <Field label="Name" value={date.name} />
                <Field label="Age" value={date.age} />
                <Field label="Gender" value={date.gender} />
                <Field label="Personal email" value={date.personal_email} />
                <Field label="Phone" value={date.phone} />
                {date.gender === 'female' && <Field label="Dress approved" value={dressText(date)} />}
              </div>
            </div>
          ) : (
            <div className="rv-sub" style={{ fontSize: 13 }}>No date on this reservation.</div>
          )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="rv-btn ghost" onClick={() => setEditing(true)}>Edit info</button>
          </div>
        </div>
      )}

      {open && editing && <VipEditForm r={r} date={date} onDone={(changed) => { setEditing(false); if (changed) onChanged(); }} />}
    </div>
  );
}

const ROLE_OPTS = Object.entries(ROLE_LABEL)
  .filter(([value]) => value !== 'visiting_xo_bc')
  .map(([value, label]) => ({ value, label }));

function VipEditForm({ r, date, onDone }) {
  const [v, setV] = useState({
    name: r.name || '',
    // Legacy XO/BC saves as the current combined role; S-6 can narrow it.
    role: r.role === 'visiting_xo_bc' ? 'visiting_leadership' : r.role,
    home_school: r.home_school || '',
    age: r.age ?? '',
    gender: r.gender || null,
    personal_email: r.personal_email || '',
    phone: r.phone || '',
    has_allergy: r.has_allergy,
    allergy_detail: r.allergy_detail || '',
    dress_approved: r.dress_approved,
  });
  const [d, setD] = useState(date ? {
    name: date.name || '',
    age: date.age ?? '',
    gender: date.gender || null,
    personal_email: date.personal_email || '',
    phone: date.phone || '',
    dress_approved: date.dress_approved,
  } : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const setVF = (k, val) => setV((o) => ({ ...o, [k]: val }));
  const setDF = (k, val) => setD((o) => ({ ...o, [k]: val }));

  async function save() {
    if (!v.name.trim() || !v.home_school.trim() || !v.personal_email.trim()) {
      setErr('Name, home school and personal email are required.');
      return;
    }
    if (d && !d.name.trim()) { setErr('Date name is required.'); return; }
    setBusy(true); setErr('');
    const vPatch = {
      name: v.name.trim(),
      role: v.role,
      home_school: v.home_school.trim(),
      age: numOrNull(v.age),
      gender: v.gender || null,
      personal_email: v.personal_email.trim(),
      phone: v.phone.trim() || null,
      has_allergy: !!v.has_allergy,
      allergy_detail: v.has_allergy ? (v.allergy_detail.trim() || null) : null,
      dress_approved: v.dress_approved,
    };
    const { error: e1 } = await SB.from('ball_vip_signups').update(vPatch).eq('id', r.id);
    let e2 = null;
    if (!e1 && d && date) {
      const dPatch = {
        name: d.name.trim(),
        age: numOrNull(d.age),
        gender: d.gender || null,
        personal_email: d.personal_email.trim() || null,
        phone: d.phone.trim() || null,
        dress_approved: d.dress_approved,
      };
      ({ error: e2 } = await SB.from('ball_vip_dates').update(dPatch).eq('id', date.id));
    }
    setBusy(false);
    if (e1 || e2) { setErr((e1 || e2).message); return; }
    onDone(true);
  }

  return (
    <div style={detailWrap}>
      <div>
        <div style={groupHead}>Edit VIP</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          <EText label="Name" value={v.name} onChange={(val) => setVF('name', val)} />
          <ESelect label="Role" value={v.role} onChange={(val) => setVF('role', val || v.role)} options={ROLE_OPTS} />
          <EText label="Home school" value={v.home_school} onChange={(val) => setVF('home_school', val)} />
          <EText label="Age" value={v.age} onChange={(val) => setVF('age', val)} inputMode="numeric" />
          <ESelect label="Gender" value={v.gender} onChange={(val) => setVF('gender', val)} options={GENDER_OPTS} />
          <EText label="Personal email" value={v.personal_email} onChange={(val) => setVF('personal_email', val)} />
          <EText label="Phone" value={v.phone} onChange={(val) => setVF('phone', val)} inputMode="tel" />
          {v.has_allergy && <EText label="Allergy detail" value={v.allergy_detail} onChange={(val) => setVF('allergy_detail', val)} />}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12 }}>
          <ECheck label="Has allergy" checked={v.has_allergy} onChange={(val) => setVF('has_allergy', val)} />
          {v.gender === 'female' && <ECheck label="Dress approved" checked={v.dress_approved} onChange={(val) => setVF('dress_approved', val)} />}
        </div>
      </div>

      {d && (
        <div>
          <div style={groupHead}>Edit date</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            <EText label="Date name" value={d.name} onChange={(val) => setDF('name', val)} />
            <EText label="Age" value={d.age} onChange={(val) => setDF('age', val)} inputMode="numeric" />
            <ESelect label="Gender" value={d.gender} onChange={(val) => setDF('gender', val)} options={GENDER_OPTS} />
            <EText label="Personal email" value={d.personal_email} onChange={(val) => setDF('personal_email', val)} />
            <EText label="Phone" value={d.phone} onChange={(val) => setDF('phone', val)} inputMode="tel" />
          </div>
          {d.gender === 'female' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12 }}>
              <ECheck label="Date dress approved" checked={d.dress_approved} onChange={(val) => setDF('dress_approved', val)} />
            </div>
          )}
        </div>
      )}

      {err && <div className="rv-flash" style={{ margin: 0 }}>{err}</div>}
      <div className="rv-actions" style={{ marginTop: 0 }}>
        <button className="rv-btn approve" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
        <button className="rv-btn ghost" disabled={busy} onClick={() => onDone(false)}>Cancel</button>
      </div>
      <p className="rv-sub" style={{ fontSize: 11, margin: 0 }}>
        S-6 write — bypasses the column guard. No email is sent.
      </p>
    </div>
  );
}
