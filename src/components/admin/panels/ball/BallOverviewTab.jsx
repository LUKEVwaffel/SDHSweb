import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, sp, fs } from '../../theme';
import { Btn, Input } from '../../shared/ui';

// S-6 full-visibility overview of the Military Ball. S-6 already has FOR ALL
// RLS on ball_signups / ball_guests (ball_signups_all_s6 / ball_guests_all_s6),
// so this reads the base tables directly — every column, both populations —
// where the ops / dress / attire portals each see only their RLS-scoped view.
//
// READ-ONLY on purpose: edits still happen on the purpose-built surfaces
// (/ball/ops payments, /ball/dress + /ball/attire attire, S-5 Ball Allergies).
// This tab is the single place S-6 can see all of it at once.

const money = (n) => (n == null ? '—' : `$${Number(n).toFixed(Number.isInteger(Number(n)) ? 0 : 2)}`);
const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

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
            />
          ))}
        </div>
      )}

      <div style={{ fontFamily: mono, fontSize: 11, color: P.faint, marginTop: sp[4] }}>
        Read-only. Change payments at /ball/ops, attire at /ball/dress + /ball/attire, allergy follow-up in the Ball Allergies panel.
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

function SignupRow({ r, guest, open, onToggle }) {
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
        onClick={onToggle}
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

      {open && (
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
        </div>
      )}
    </div>
  );
}
