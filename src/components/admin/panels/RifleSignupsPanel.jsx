import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, fs, sp } from '../theme';
import { Btn, PanelHeader, EmptyState } from '../shared/ui';

// S-6 view of rifle team interest signups (see supabase/rifle_signup.sql).
// Reads the base table directly — s6 already has full RLS access via
// rifle_signups_all_s6, unlike the reviewer portal which reads the scoped
// rifle_signups_review_view (RifleSignupsPortal.jsx, /rifle/signup-review).
function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(rows) {
  const headers = ['School Email', 'Personal Email', 'Parent Email', 'Phone', 'Signed Up'];
  const lines = [headers.join(',')];
  rows.forEach((r) => {
    lines.push([r.school_email, r.personal_email, r.parent_email, r.phone, new Date(r.created_at).toLocaleString()].map(csvCell).join(','));
  });
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rifle-signups-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function RifleSignupsPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [copied, setCopied] = useState(false);

  async function copyPhones(list) {
    const text = list.map((r) => r.phone).filter(Boolean).join('\n');
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await SB.from('rifle_signups').select('*').order('created_at', { ascending: false });
    setRows(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = SB.channel('rifle-signups-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rifle_signups' }, load)
      .subscribe();
    return () => { SB.removeChannel(channel); };
  }, [load]);

  const term = q.trim().toLowerCase();
  const filtered = term
    ? rows.filter((r) => [r.school_email, r.personal_email, r.parent_email].some((v) => (v || '').toLowerCase().includes(term)))
    : rows;

  return (
    <div>
      <PanelHeader
        title="RIFLE SIGNUPS"
        sub={`${rows.length} cadet${rows.length === 1 ? '' : 's'} signed up · new/JV interest, 2026-27 season`}
        action={<Btn onClick={load} variant="ghost" size="sm">REFRESH</Btn>}
      />

      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[4] }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by email…"
            style={{
              flex: 1, maxWidth: 320, background: P.deep, border: `1px solid ${P.hair}`, color: P.cream,
              fontFamily: mono, fontSize: fs.sm, padding: '9px 12px', outline: 'none',
            }}
          />
          <Btn onClick={() => copyPhones(rows)} variant="ghost" size="sm">{copied ? 'COPIED!' : 'COPY PHONE NUMBERS'}</Btn>
          <Btn onClick={() => exportCsv(rows)} variant="ghost" size="sm">EXPORT CSV</Btn>
        </div>
      )}

      {loading ? (
        <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, textAlign: 'center', marginTop: sp[8] }}>LOADING…</div>
      ) : rows.length === 0 ? (
        <EmptyState icon="⊙" title="NOBODY HAS SIGNED UP YET" hint="Interest signups from /rifle/signup appear here." />
      ) : filtered.length === 0 ? (
        <EmptyState icon="⊙" title="NO MATCHES" hint={`Nothing matches "${q}".`} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[3] }}>
          {filtered.map((r) => (
            <div key={r.id} style={{ background: P.deep, border: `1px solid ${P.hair}`, padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: mono, fontSize: fs.sm, color: P.cream, letterSpacing: '0.02em' }}>{r.school_email}</div>
                <div style={{ fontFamily: mono, fontSize: fs.sm, color: P.gold, fontWeight: 700, letterSpacing: '0.02em' }}>{r.phone}</div>
              </div>
              <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute, marginTop: 6, letterSpacing: '0.02em' }}>
                Personal: {r.personal_email} &middot; Parent: {r.parent_email}
              </div>
              <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute, marginTop: 4, letterSpacing: '0.08em' }}>
                Signed up {new Date(r.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
