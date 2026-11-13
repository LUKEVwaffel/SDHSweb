import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter, oswald } from '../../theme';
import { Btn, Card, EmptyState } from '../../shared/ui';

// DISPATCH → Ball → FEEDBACK. Printable QR for the tables pointing at the
// public /ballfeedback form, plus a read-only view of what came in.
// Table + RLS: supabase/BALL_FEEDBACK.sql.

const FEEDBACK_PATH = '/ballfeedback';
const ISSUE_LABELS = {
  signup: 'Signing up', guest_invite: 'Adding guest', payment: 'Payment',
  dress: 'Dress approval', emails: 'Emails', checkin: 'Door check-in',
};

const avg = (nums) => (nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '—');

export default function BallFeedbackTab() {
  const url = `${window.location.origin}${FEEDBACK_PATH}`;
  const [qr, setQr] = useState('');
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 600, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#081729', light: '#ffffff' } })
      .then((data) => { if (alive) setQr(data); })
      .catch(() => { if (alive) setErr('QR code could not be generated — use the link instead.'); });
    return () => { alive = false; };
  }, [url]);

  const load = useCallback(async () => {
    const { data, error } = await SB.from('ball_feedback').select('*').order('created_at', { ascending: false });
    if (error) {
      setErr(/does not exist/i.test(error.message) ? 'Run supabase/BALL_FEEDBACK.sql in Supabase first.' : `Could not load feedback: ${error.message}`);
      setRows([]);
      return;
    }
    setRows(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function printQr() {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><title>Ball Feedback QR</title>
      <style>body{font-family:Georgia,serif;text-align:center;padding:40px;color:#081729}
      h1{font-size:34px;margin:0 0 6px}p{font-size:16px;margin:0 0 24px}img{width:360px}
      .u{font-family:monospace;font-size:13px;margin-top:14px}</style>
      <h1>How was your night?</h1><p>Scan to share feedback on the Ball &amp; the reservation process.</p>
      <img src="${qr}" alt="QR code"/><div class="u">${url}</div>
      <script>window.onload=()=>window.print()</script>`);
    w.document.close();
  }

  const list = rows || [];
  const issueCounts = list.flatMap((r) => r.setup_issues || []).reduce((acc, k) => ({ ...acc, [k]: (acc[k] || 0) + 1 }), {});

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Card style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
        {qr ? <img src={qr} alt="QR code for ball feedback form" width={160} height={160} style={{ background: '#fff', borderRadius: 6 }} /> : <div style={{ width: 160, height: 160 }} />}
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontFamily: oswald, fontSize: 18, color: P.cream }}>Table QR code</div>
          <div style={{ fontFamily: inter, fontSize: 13, color: P.mute, margin: '6px 0 12px' }}>
            Print and put on the tables. Opens the short feedback form — the night + the reservation/setup process.
          </div>
          <div style={{ fontFamily: mono, fontSize: 12, color: P.gold, marginBottom: 12, wordBreak: 'break-all' }}>{url}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn variant="gold" size="sm" onClick={printQr} disabled={!qr}>PRINT QR</Btn>
            {qr && <Btn size="sm" variant="ghost" onClick={() => { const a = document.createElement('a'); a.href = qr; a.download = 'ball-feedback-qr.png'; a.click(); }}>DOWNLOAD PNG</Btn>}
            <Btn size="sm" variant="ghost" onClick={() => window.open(FEEDBACK_PATH, '_blank')}>OPEN FORM</Btn>
          </div>
        </div>
      </Card>

      {err && <div style={{ fontFamily: mono, fontSize: 12, color: P.red }}>{err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <Stat label="RESPONSES" value={rows ? list.length : '…'} />
        <Stat label="BALL AVG / 5" value={avg(list.map((r) => r.ball_rating))} />
        <Stat label="SETUP AVG / 5" value={avg(list.map((r) => r.setup_rating).filter(Boolean))} />
      </div>

      {Object.keys(issueCounts).length > 0 && (
        <Card>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.18em', color: P.gold, marginBottom: 10 }}>SETUP TROUBLE SPOTS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(issueCounts).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
              <span key={k} style={{ fontFamily: inter, fontSize: 12.5, color: P.cream, border: `1px solid ${P.hair}`, borderRadius: 999, padding: '5px 12px' }}>
                {ISSUE_LABELS[k] || k} · {n}
              </span>
            ))}
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Btn size="sm" variant="ghost" onClick={load}>REFRESH</Btn></div>

      {rows && list.length === 0 && !err && <EmptyState title="No feedback yet" hint="Responses show up here as people scan the QR code." />}

      {list.map((r) => (
        <Card key={r.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontFamily: mono, fontSize: 11, color: P.mute }}>
            <span>{(r.submitter_name || 'Anonymous')} · {r.attendee_type.toUpperCase()}</span>
            <span>BALL {r.ball_rating}/5 · SETUP {r.setup_rating ? `${r.setup_rating}/5` : '—'} · {new Date(r.created_at).toLocaleString()}</span>
          </div>
          {r.best_part && <Quote label="Best part" text={r.best_part} />}
          {r.improve && <Quote label="Fix next year" text={r.improve} />}
          {r.setup_issues?.length > 0 && (
            <div style={{ fontFamily: inter, fontSize: 12, color: P.faint, marginTop: 8 }}>
              Trouble with: {r.setup_issues.map((k) => ISSUE_LABELS[k] || k).join(', ')}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <Card>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.18em', color: P.gold }}>{label}</div>
      <div style={{ fontFamily: oswald, fontSize: 30, color: P.cream, marginTop: 4 }}>{value}</div>
    </Card>
  );
}

function Quote({ label, text }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontFamily: inter, fontSize: 11, color: P.gold }}>{label}</div>
      <div style={{ fontFamily: inter, fontSize: 13.5, color: P.cream, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{text}</div>
    </div>
  );
}
