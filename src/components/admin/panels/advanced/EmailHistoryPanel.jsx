import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter, fs, sp } from '../../theme';
import { Btn, Card, PanelHeader, EmptyState } from '../../shared/ui';

// Read-only audit trail for every outbound email. Each message row already
// carries its own lifecycle timestamps (created → submitted → reviewed →
// sent), so this panel just surfaces them as a timeline — no separate log
// table needed. pdf_generated_at/signed_at/signed_by are legacy paper-override
// fields (that path was retired, supabase/email_review_revoke_override.sql) —
// still rendered conditionally so old signed-off messages keep their history.
const STATUS_COLOR = {
  draft: P.mute,
  pending_review: P.bright,
  changes_requested: P.red,
  approved: P.green,
  sent: P.gold,
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

export default function EmailHistoryPanel({ adminId }) {
  const [rows, setRows] = useState([]);
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState(null);
  const [mineOnly, setMineOnly] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await SB.from('email_messages').select('*').order('created_at', { ascending: false });
    if (error) { setMissing(true); return; }
    setMissing(false);
    setRows(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (missing) {
    return <Card><div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute }}>Email tables not found. Run the email SQL migrations first.</div></Card>;
  }

  // Every message is visible regardless of who drafted it — both S-6 accounts
  // can already tell whose is whose via created_by. "Mine" just narrows the
  // view for someone checking their own activity, not an access boundary.
  const visibleRows = mineOnly ? rows.filter((r) => r.created_by === adminId) : rows;

  return (
    <div style={{ maxWidth: 760 }}>
      <PanelHeader
        title="EMAIL HISTORY"
        sub={`${visibleRows.length} message(s) · full review + send audit trail`}
        action={
          <div style={{ display: 'flex', gap: sp[2] }}>
            <Btn onClick={() => setMineOnly(false)} variant={!mineOnly ? 'gold' : 'ghost'} size="sm">ALL</Btn>
            <Btn onClick={() => setMineOnly(true)} variant={mineOnly ? 'gold' : 'ghost'} size="sm">MINE</Btn>
            <Btn onClick={load} variant="ghost" size="sm">REFRESH</Btn>
          </div>
        }
      />
      {visibleRows.length === 0 ? (
        <EmptyState icon="✉" title="NO EMAIL HISTORY" hint="Once you build, submit, and send messages they appear here with a full timeline." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2] }}>
          {visibleRows.map((r) => {
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
                      {r.status === 'sent' && r.sent_at ? `Sent ${fmtDate(r.sent_at)} → ${r.recipient_count ?? '?'}`
                        : r.status === 'pending_review' ? `Awaiting review · ${r.assigned_reviewer_email || 'unassigned'}`
                        : r.status === 'changes_requested' ? `Changes requested by ${r.reviewed_by || 'reviewer'}`
                        : r.status === 'approved' ? `Approved by ${r.reviewed_by || 'reviewer'}`
                        : `Created ${fmtDate(r.created_at)} by ${r.created_by || 'unknown'}`}
                    </div>
                  </div>
                  <span style={{ fontFamily: mono, fontSize: fs.tiny, color, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>{(r.status || 'draft').replace('_', ' ').toUpperCase()}</span>
                  <span style={{ fontFamily: mono, fontSize: fs.sm, color: P.mute }}>{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <div style={{ padding: `0 ${sp[4]}px ${sp[4]}px`, display: 'flex', flexDirection: 'column', gap: sp[3], borderTop: `1px solid ${P.hair}`, marginTop: 2, paddingTop: sp[3] }}>
                    <Step label="1 · CREATED" when={r.created_at} who={r.created_by} color={P.mute} />
                    <Step label="2 · SUBMITTED FOR REVIEW" when={r.submitted_at} who={r.assigned_reviewer_email} color={P.bright} />
                    <Step
                      label="3 · REVIEWED"
                      when={r.reviewed_at}
                      who={r.reviewed_by}
                      color={r.status === 'changes_requested' ? P.red : P.green}
                      detail={r.status === 'changes_requested' ? 'changes requested' : r.reviewed_at ? 'approved' : null}
                    />
                    {r.status === 'changes_requested' && r.reviewer_feedback && (
                      <div style={{ fontFamily: mono, fontSize: 9, color: P.red, marginLeft: 20, marginTop: -6 }}>&ldquo;{r.reviewer_feedback}&rdquo;</div>
                    )}
                    {/* Legacy paper-override fields — that path was retired (see
                        supabase/email_review_revoke_override.sql); only rendered
                        for messages that went through it before the retirement. */}
                    {(r.pdf_generated_at || r.signed_at) && (
                      <>
                        <Step label="LEGACY · PRINTED FOR SIGNATURE" when={r.pdf_generated_at} color={P.bright} />
                        <Step label="LEGACY · SIGNED · CLEARED" when={r.signed_at} who={r.signed_by} color={P.green} />
                      </>
                    )}
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
