import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono } from '../theme';

// Read-only list of /rifle/signup interest signups, scoped through
// rifle_signups_review_view (is_rifle_admin() was added to that view's gate
// alongside this tab — Makaio previously had no way to see who signed up for
// his own team; only S-6/reviewers could). No write path here on purpose:
// editing lives in DISPATCH, this is just visibility.
export default function SignupsTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await SB.from('rifle_signups_review_view').select('*').order('created_at', { ascending: false });
    if (error) { setErr(error.message); setLoading(false); return; }
    setErr('');
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = SB.channel('rifle-portal-signups-tab')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rifle_signups' }, load)
      .subscribe();
    return () => { SB.removeChannel(channel); };
  }, [load]);

  const term = q.trim().toLowerCase();
  const filtered = term
    ? rows.filter((r) => [r.cadet_name, r.school_email, r.personal_email, r.parent_email].some((v) => (v || '').toLowerCase().includes(term)))
    : rows;

  const inputStyle = {
    width: '100%', maxWidth: 320, background: P.deep, border: `1px solid ${P.hair}`, color: P.cream,
    fontFamily: mono, fontSize: 13, padding: '9px 12px', outline: 'none',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>
          {rows.length} cadet{rows.length === 1 ? '' : 's'} signed up
        </div>
        <button onClick={load} style={{ background: 'transparent', border: `1px solid ${P.hairStrong}`, color: P.mute, fontFamily: mono, fontSize: 11, letterSpacing: '0.1em', padding: '7px 14px', cursor: 'pointer' }}>
          REFRESH
        </button>
      </div>

      {rows.length > 0 && (
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email…" style={{ ...inputStyle, marginBottom: 18 }} />
      )}

      {err && <div style={{ fontFamily: mono, fontSize: 12, color: P.red, marginBottom: 14 }}>{err}</div>}

      {loading ? (
        <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>Loading&hellip;</div>
      ) : rows.length === 0 ? (
        <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>Nobody has signed up yet — signups from /rifle/signup appear here.</div>
      ) : filtered.length === 0 ? (
        <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>Nothing matches &ldquo;{q}&rdquo;.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((r) => (
            <div key={r.id} style={{ background: P.deep, border: `1px solid ${P.hair}`, padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: mono, fontSize: 13, color: P.cream, fontWeight: 700, letterSpacing: '0.02em' }}>
                  {r.cadet_name || '(no roster match)'}
                </div>
                <div style={{ fontFamily: mono, fontSize: 13, color: P.gold, fontWeight: 700, letterSpacing: '0.02em' }}>{r.phone}</div>
                {r.is_varsity && (
                  <div style={{ fontFamily: mono, fontSize: 10, color: P.ink, background: P.gold, fontWeight: 700, letterSpacing: '0.1em', padding: '2px 8px' }}>
                    VARSITY
                  </div>
                )}
              </div>
              {(r.cadet_company || r.cadet_grade || r.cadet_let_level || r.cadet_birthdate) && (
                <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 4 }}>
                  {[r.cadet_company, r.cadet_grade && `Grade ${r.cadet_grade}`, r.cadet_let_level && `LET ${r.cadet_let_level}`, r.cadet_birthdate && new Date(r.cadet_birthdate).toLocaleDateString()]
                    .filter(Boolean).join(' · ')}
                </div>
              )}
              <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 4 }}>
                {r.school_email} &middot; Personal: {r.personal_email} &middot; Parent: {r.parent_email}
              </div>
              <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 4, letterSpacing: '0.08em' }}>
                Signed up {new Date(r.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
