import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter, fs, sp } from '../../theme';
import { Btn, Card, PanelHeader, EmptyState } from '../../shared/ui';

// Read-only audit trail for every outbound email. Each message row already
// carries its own lifecycle timestamps (created → printed → signed → sent), so
// this panel just surfaces them as a timeline — no separate log table needed.
const STATUS_COLOR = {
  draft: P.mute, pending_signature: P.bright, signed: P.green, sent: P.gold,
};

function fmtDate(v) {
  return v ? new Date(v).toLocaleString() : null;
}

function Step({ label, when, who, color, detail }) {
  const done = !!when;
  return (
    <div style={{ display: 'flex', gap: sp[3], alignItems: 'flex-start', opacity: done ? 1 : 0.4 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: done ? color : P.hair, marginTop: 5, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: mono, fontSize: fs.tiny, color: done ? P.cream : P.mute, letterSpacing: '0.08em' }}>{label}</div>
        <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, marginTop: 1 }}>
          {when ? fmtDate(when) : 'not yet'}{who ? ` · ${who}` : ''}{detail ? ` · ${detail}` : ''}
        </div>
      </div>
    </div>
  );
}

export default function EmailHistoryPanel() {
  const [rows, setRows] = useState([]);
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await SB.from('email_messages').select('*').order('created_at', { ascending: false });
    if (error) { setMissing(true); return; }
    setMissing(false);
    setRows(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (missing) {
    return <Card><div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute }}>Email tables not found — run the email SQL migrations first.</div></Card>;
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <PanelHeader title="EMAIL HISTORY" sub={`${rows.length} message(s) · signed / sent audit trail`} action={<Btn onClick={load} variant="ghost" size="sm">REFRESH</Btn>} />
      {rows.length === 0 ? (
        <EmptyState icon="✉" title="NO EMAIL HISTORY" hint="Once you build, sign, and send messages they appear here with a full timeline." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2] }}>
          {rows.map((r) => {
            const color = STATUS_COLOR[r.status] || P.mute;
            const isOpen = open === r.id;
            return (
              <Card key={r.id} style={{ padding: 0 }}>
                <button onClick={() => setOpen(isOpen ? null : r.id)} style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer', background: 'transparent', border: 'none',
                  padding: `${sp[3]}px ${sp[4]}px`, display: 'flex', alignItems: 'center', gap: sp[3],
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: inter, fontSize: fs.base, color: P.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subject}</div>
                    <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, marginTop: 2 }}>
                      {r.status === 'sent' && r.sent_at ? `Sent ${fmtDate(r.sent_at)} → ${r.recipient_count ?? '?'}` : `Created ${fmtDate(r.created_at)}`}
                    </div>
                  </div>
                  <span style={{ fontFamily: mono, fontSize: fs.tiny, color, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>{(r.status || 'draft').replace('_', ' ').toUpperCase()}</span>
                  <span style={{ fontFamily: mono, fontSize: fs.sm, color: P.mute }}>{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <div style={{ padding: `0 ${sp[4]}px ${sp[4]}px`, display: 'flex', flexDirection: 'column', gap: sp[3], borderTop: `1px solid ${P.hair}`, marginTop: 2, paddingTop: sp[3] }}>
                    <Step label="1 · CREATED" when={r.created_at} who={r.created_by} color={P.mute} />
                    <Step label="2 · PRINTED FOR SIGNATURE" when={r.pdf_generated_at} color={P.bright} />
                    <Step label="3 · SIGNED · CLEARED" when={r.signed_at} who={r.signed_by} color={P.green} />
                    <Step label="4 · SENT" when={r.sent_at} color={P.gold} detail={r.recipient_count != null ? `${r.recipient_count} recipients` : null} />
                    {r.send_error && <div style={{ fontFamily: mono, fontSize: 9, color: P.red, marginTop: 2 }}>Last error: {r.send_error}</div>}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
