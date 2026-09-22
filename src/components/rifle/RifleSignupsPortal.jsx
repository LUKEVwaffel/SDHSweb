import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase as SB } from '../../lib/supabaseClient';
import PortalMovedNotice from '../portal/PortalMovedNotice';
import { isPortalMoveNoticeActive } from '../portal/portalMoveConfig';
import '../review/review.css';

function fmtDate(v) {
  return v ? new Date(v).toLocaleString() : '—';
}

// Postgres `date` columns come back as a bare "YYYY-MM-DD" string — parsing
// that directly with `new Date()` reads it as UTC midnight, which rolls
// back a day in any negative-UTC timezone. Building the Date from parts
// keeps it local and avoids that off-by-one.
function formatBirthdate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
}

function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(rows) {
  const headers = ['Name', 'Company', 'Grade', 'LET Level', 'Birthdate', 'School Email', 'Personal Email', 'Parent Email', 'Phone', 'Varsity', 'Signed Up'];
  const lines = [headers.join(',')];
  rows.forEach((r) => {
    lines.push([
      r.cadet_name, r.cadet_company, r.cadet_grade, r.cadet_let_level, r.cadet_birthdate,
      r.school_email, r.personal_email, r.parent_email, r.phone, r.is_varsity ? 'Yes' : 'No', fmtDate(r.created_at),
    ].map(csvCell).join(','));
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

// Read-only reviewer view of rifle team interest signups — Kaz/Chief, same
// email_reviewers account + login as the Email Review and Ball Ops portals
// (see EmailOnlyLogin/BallDressLogin.jsx, rifle_signup.sql for the RLS view this reads from).
export default function RifleSignupsPortal() {
  const [phase, setPhase] = useState('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [copied, setCopied] = useState(false);

  async function copyPhones(list) {
    const text = list.map((r) => r.phone).filter(Boolean).join('\n');
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const loadAll = useCallback(async () => {
    const { data, error } = await SB.from('rifle_signups_review_view').select('*').order('created_at', { ascending: false });
    if (error) { setPhase('error'); setErrorMsg(error.message); return; }
    setRows(data || []);
    setPhase('ready');
  }, []);

  const verifyAndLoad = useCallback(async () => {
    const { data: { session } } = await SB.auth.getSession();
    if (!session) { setPhase('login'); return; }
    const { data: rev } = await SB.from('email_reviewers')
      .select('email').eq('email', session.user.email.toLowerCase()).eq('active', true).eq('can_rifle_signups', true).maybeSingle();
    if (!rev) { setPhase('login'); return; }
    await loadAll();
  }, [loadAll]);

  useEffect(() => { verifyAndLoad(); }, [verifyAndLoad]);

  useEffect(() => {
    if (phase !== 'ready') return undefined;
    const channel = SB.channel('rifle-signups-portal')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rifle_signups' }, loadAll)
      .subscribe();
    return () => { SB.removeChannel(channel); };
  }, [phase, loadAll]);

  async function signOut() {
    await SB.auth.signOut();
    setRows([]);
    setPhase('login');
  }

  const shell = (children) => (
    <div className="rv">
      <div className="rv-shell">
        <div className="rv-eyebrow">Trojan Battalion &middot; Rifle Signups</div>
        {children}
      </div>
    </div>
  );

  if (phase === 'checking') return shell(<p className="rv-sub"><span className="rv-dot" />Checking your session&hellip;</p>);
  if (phase === 'login') return isPortalMoveNoticeActive() ? <PortalMovedNotice portalName="Rifle Signups" /> : <Navigate to="/portal" replace />;
  if (phase === 'error') return shell(
    <div className="rv-panel" style={{ borderColor: '#dcbdb6' }}>
      <h1 className="rv-h1" style={{ fontSize: 20, color: 'var(--rv-red)' }}>Something went wrong</h1>
      <p className="rv-sub" style={{ marginTop: 10 }}>{errorMsg}</p>
    </div>
  );

  const term = q.trim().toLowerCase();
  const filtered = term
    ? rows.filter((r) => [r.cadet_name, r.school_email, r.personal_email, r.parent_email].some((v) => (v || '').toLowerCase().includes(term)))
    : rows;

  return shell(
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <h1 className="rv-h1" style={{ fontSize: 22, margin: '4px 0 4px' }}>Rifle Signups</h1>
        <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
          <button className="rv-link" onClick={() => { window.location.href = '/review'; }}>Switch portal</button>
          <button className="rv-link" onClick={signOut}>Sign out</button>
        </div>
      </div>
      <p className="rv-sub" style={{ marginBottom: 22 }}>{rows.length} cadet{rows.length === 1 ? '' : 's'} signed up.</p>

      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {rows.length > 6 && (
            <input className="rv-search" placeholder="Search by name or email…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
          )}
          <button className="rv-link" onClick={() => copyPhones(rows)}>{copied ? 'Copied!' : 'Copy phone numbers'}</button>
          <button className="rv-link" onClick={() => exportCsv(rows)}>Export CSV</button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rv-card rv-empty">Nobody has signed up yet.</div>
      ) : filtered.length === 0 ? (
        <div className="rv-card rv-empty">No signups match "{q}".</div>
      ) : (
        <div className="rv-list">
          {filtered.map((r) => (
            <div key={r.id} className="rv-row" style={{ cursor: 'default' }}>
              <div className="rv-row-title" style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                {r.cadet_name || '(no roster match)'}
                <span style={{ fontWeight: 700, color: 'var(--rv-accent)' }}>{r.phone}</span>
                {r.is_varsity && (
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#06101F', background: 'var(--rv-accent)', padding: '2px 8px' }}>
                    VARSITY
                  </span>
                )}
              </div>
              {(r.cadet_company || r.cadet_grade || r.cadet_let_level || r.cadet_birthdate) && (
                <div className="rv-row-meta">
                  {[r.cadet_company, r.cadet_grade && `Grade ${r.cadet_grade}`, r.cadet_let_level && `LET ${r.cadet_let_level}`, r.cadet_birthdate && formatBirthdate(r.cadet_birthdate)]
                    .filter(Boolean).join(' · ')}
                </div>
              )}
              <div className="rv-row-meta">
                {r.school_email} &middot; Personal: {r.personal_email} &middot; Parent: {r.parent_email}
              </div>
              <div className="rv-row-meta">Signed up {fmtDate(r.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
