import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';

import { VIP_ROLE_LABELS as ROLE_LABEL } from '../../../../../supabase/functions/_shared/ballVipRoles.js';

// Self-contained, read-only list of ball_vip_signups (visiting XO/BC/CSM +
// past King/Queen — see ball_vip_signup.sql), each with its optional
// ball_vip_dates row (King/Queen only). Self-reported, no approval gate;
// this just gives Chief/S-6 visibility into who actually signed up.
// Leadership signups that only said "XO/BC/CSM" (or the legacy "XO/BC") can
// be pinned to one specific role here — S-6 RLS + the column guard allow it.
const UNIDENTIFIED_ROLES = new Set(['visiting_leadership', 'visiting_xo_bc']);
const SPECIFIC_ROLES = ['visiting_csm', 'visiting_xo', 'visiting_bc'];
const isLeadership = (role) => UNIDENTIFIED_ROLES.has(role) || SPECIFIC_ROLES.includes(role);

export default function BallVipList() {
  const [rows, setRows] = useState(null);
  const [datesBySignup, setDatesBySignup] = useState({});
  const [err, setErr] = useState('');
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    const [{ data: v, error: vErr }, { data: d, error: dErr }] = await Promise.all([
      SB.from('ball_vip_signups').select('*').order('created_at', { ascending: false }),
      SB.from('ball_vip_dates').select('*'),
    ]);
    if (vErr || dErr) { setErr((vErr || dErr).message); return; }
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

  const unidentifiedCount = (rows || []).filter((r) => UNIDENTIFIED_ROLES.has(r.role)).length;

  if (rows === null) return null;
  if (rows.length === 0 && !err) return null;

  return (
    <div style={{ marginTop: 22 }}>
      <div className="bp-head" style={{ marginBottom: 10 }}>
        <h2 className="bp-title" style={{ fontSize: 15 }}>Visiting Guests ({rows.length})</h2>
        <button className="bp-refresh" onClick={load}>Refresh</button>
      </div>
      <p className="rv-sub" style={{ fontSize: 12, marginBottom: 10 }}>
        Self-reported via /ball/vip &mdash; visiting XO/BC/CSM and past King/Queen (only a King/Queen may bring a date). Comped, no payment tracked here.
        Female dress approval is handled at /ball/dress, same queue as cadets/guests.
      </p>
      {unidentifiedCount > 0 && (
        <div className="rv-flash" style={{ marginBottom: 10 }}>
          {unidentifiedCount} leadership {unidentifiedCount === 1 ? 'guest has' : 'guests have'} no specific role yet &mdash; pick CSM, XO or BC below.
        </div>
      )}
      {err && <div className="rv-flash">{err}</div>}
      <div className="rv-list">
        {rows.map((r) => {
          const d = datesBySignup[r.id];
          const unidentified = UNIDENTIFIED_ROLES.has(r.role);
          return (
            <div
              key={r.id}
              style={{
                background: 'var(--rv-surface)', border: '1px solid var(--rv-border)',
                borderRadius: 'var(--rv-radius)', padding: '10px 14px',
                ...(unidentified ? { borderLeft: '3px solid var(--rv-accent)' } : null),
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <strong>{r.name}</strong>
                  <span style={{ color: 'var(--rv-faint)' }}> &middot; {ROLE_LABEL[r.role] || r.role} &middot; {r.home_school}</span>
                  {isLeadership(r.role) && (
                    <select
                      aria-label={`Leadership role for ${r.name}`}
                      value={unidentified ? '' : r.role}
                      disabled={savingId === r.id}
                      onChange={(e) => setRole(r, e.target.value)}
                      style={{ marginLeft: 10, fontSize: 12 }}
                    >
                      {unidentified && <option value="" disabled>Who is this? (CSM / XO / BC)</option>}
                      {SPECIFIC_ROLES.map((role) => (
                        <option key={role} value={role}>{ROLE_LABEL[role]}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div style={{ color: 'var(--rv-faint)', fontSize: 12 }}>
                  {r.age ?? '—'} &middot; {r.gender || '—'}
                  {r.has_allergy ? ` · allergy: ${r.allergy_detail || 'yes'}` : ''}
                  {r.gender === 'female' ? ` · ${r.dress_approved ? 'dress approved' : 'dress pending'}` : ''}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--rv-faint)', marginTop: 4 }}>
                {r.personal_email}{r.phone ? ` · ${r.phone}` : ''}
              </div>
              {d && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--rv-border)', fontSize: 12 }}>
                  <strong>+ {d.name}</strong>
                  <span style={{ color: 'var(--rv-faint)' }}>
                    {' '}&middot; date &middot; {d.age ?? '—'} &middot; {d.gender || '—'}
                    {d.gender === 'female' ? ` · ${d.dress_approved ? 'dress approved' : 'dress pending'}` : ''}
                    {d.personal_email ? ` · ${d.personal_email}` : ''}{d.phone ? ` · ${d.phone}` : ''}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
