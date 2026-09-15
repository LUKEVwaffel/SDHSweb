import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';

const ROLE_LABEL = { visiting_xo_bc: 'Visiting XO/BC', past_king_queen: 'Past King/Queen' };

// Self-contained, read-only list of ball_vip_signups (visiting XO/BC + past
// King/Queen — see ball_vip_signup.sql). Self-reported, no approval gate;
// this just gives Chief/S-6 visibility into who actually signed up.
export default function BallVipList() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    SB.from('ball_vip_signups').select('*').order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { setErr(error.message); return; }
        setRows(data || []);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  if (rows === null) return null;
  if (rows.length === 0 && !err) return null;

  return (
    <div style={{ marginTop: 22 }}>
      <div className="bp-head" style={{ marginBottom: 10 }}>
        <h2 className="bp-title" style={{ fontSize: 15 }}>Visiting Guests ({rows.length})</h2>
        <button className="bp-refresh" onClick={load}>Refresh</button>
      </div>
      <p className="rv-sub" style={{ fontSize: 12, marginBottom: 10 }}>
        Self-reported via /ball/vip &mdash; visiting XO/BC and past King/Queen. Comped, no payment tracked here.
        Female dress approval is handled at /ball/dress, same queue as cadets/guests.
      </p>
      {err && <div className="rv-flash">{err}</div>}
      <div className="rv-list">
        {rows.map((r) => (
          <div
            key={r.id}
            style={{
              background: 'var(--rv-surface)', border: '1px solid var(--rv-border)',
              borderRadius: 'var(--rv-radius)', padding: '10px 14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <strong>{r.name}</strong>
                <span style={{ color: 'var(--rv-faint)' }}> &middot; {ROLE_LABEL[r.role] || r.role} &middot; {r.home_school}</span>
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
          </div>
        ))}
      </div>
    </div>
  );
}
