import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter, fs, sp } from '../../theme';
import { Btn, Card, Label, Input, PanelHeader, EmptyState } from '../../shared/ui';
import { printEmailMessage } from './emailPrint';
import { blocksToHtml, blocksToText } from './emailRender';
import EmailBuilder from './builder/EmailBuilder';
import { starterBlocks } from './builder/blocks';

const STATUS_META = {
  draft:              { label: 'DRAFT',              color: P.mute },
  pending_review:     { label: 'PENDING REVIEW',     color: P.bright },
  changes_requested:  { label: 'CHANGES REQUESTED',  color: P.red },
  approved:           { label: 'APPROVED · CLEARED', color: P.green },
  pending_signature:  { label: 'PENDING SIGNATURE',  color: P.bright },
  signed:             { label: 'SIGNED · CLEARED',   color: P.green },
  sent:               { label: 'SENT',               color: P.gold },
};

// Recognized signatories who may physically sign a release. Extend here — not
// hardcoded to one person. Kept in sync with SIGNERS_LABEL in emailPrint.js.
const SIGNERS = ['SAI', '1SG', 'Sgt Kaz (Jay Kazminski)'];

// Back-fill blocks from a row: prefer structured content_json; fall back to
// wrapping legacy plaintext body so old drafts still open in the builder.
function rowToBlocks(r) {
  if (Array.isArray(r?.content_json) && r.content_json.length) return r.content_json;
  if (r?.body) return [{ id: `legacy_${r.id}`, type: 'text', text: r.body }];
  return starterBlocks();
}

export default function Messages({ adminId }) {
  const [rows, setRows] = useState([]);
  const [missing, setMissing] = useState(false);
  const [sel, setSel] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({ subject: '', blocks: [] });
  const [busy, setBusy] = useState('');
  const [sendState, setSendState] = useState('idle'); // idle | sending | sent | error
  const [sendMsg, setSendMsg] = useState('');
  const [signer, setSigner] = useState(SIGNERS[0]);
  const [canOverride, setCanOverride] = useState(false);
  const [isS6, setIsS6] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewers, setReviewers] = useState([]);
  const [pickedReviewer, setPickedReviewer] = useState('');
  const gateRef = useRef(null);

  const [deletedNotice, setDeletedNotice] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await SB.from('email_messages').select('*').order('created_at', { ascending: false });
    if (error) { setMissing(true); return; }
    setMissing(false);
    setRows(data || []);
    setSel((prev) => {
      if (!prev) return null;
      const next = data.find((r) => r.id === prev.id) || null;
      // Row vanished underneath us — e.g. a reviewer deleted this pending
      // request from their side. Surface it instead of the editor just
      // silently closing with no explanation.
      if (!next) setDeletedNotice(true);
      return next;
    });
  }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // Kaiden's individual paper-override capability — the legacy print/sign path
  // stays hidden from everyone else, including other s6 accounts. Also reads
  // role here (one query, not two): the DELETE button is explicit-gated to
  // s6 client-side, same defense-in-depth posture as canOverride, on top of
  // the real backstop (email_messages_all_s6 RLS + Dashboard.jsx never
  // routing s5 to this panel at all).
  useEffect(() => {
    (async () => {
      const { data } = await SB.from('admin_roles').select('role, can_override_review').eq('email', adminId).maybeSingle();
      setCanOverride(!!data?.can_override_review);
      setIsS6(data?.role === 's6');
    })();
  }, [adminId]);

  // Reviewer picker options — admin reads full email_reviewers via is_s6().
  useEffect(() => {
    (async () => {
      const { data } = await SB.from('email_reviewers').select('email, display_name').eq('active', true);
      setReviewers(data || []);
      setPickedReviewer((prev) => prev || data?.[0]?.email || '');
    })();
  }, []);

  function resetSend() { setSendState('idle'); setSendMsg(''); }
  function newDraft() {
    setSel(null);
    setIsNew(true);
    setForm({ subject: '', blocks: starterBlocks() });
    setBusy('');
    setDeletedNotice(false);
    resetSend();
  }
  function selectMsg(r) {
    setSel(r);
    setIsNew(false);
    setForm({ subject: r.subject, blocks: rowToBlocks(r) });
    setBusy('');
    setDeletedNotice(false);
    resetSend();
  }
  function closeEditor() {
    setSel(null);
    setIsNew(false);
  }

  // Destructive — straightforward delete of the row, any status. s6-only:
  // Dashboard.jsx never routes s5 to this panel at all (ROLE_SECTIONS), the
  // email_messages_all_s6 RLS policy is the real backstop, and isS6 above is
  // an explicit client-side check on top, same posture as canOverride.
  // Logged to change_log BEFORE the delete (same order as EventsPanel.jsx's
  // del()) so the audit row lands even if the delete itself fails partway,
  // and value_before captures the full row for forensic recovery context.
  async function deleteMessage(r) {
    if (!isS6) return;
    const label = r.status === 'pending_review' ? 'this pending review request' : 'this message';
    if (!confirm(`Delete ${label} — "${r.subject}"? This cannot be undone.`)) return;
    await SB.from('change_log').insert({
      admin_id: adminId, page: 'email', element: r.id,
      label: `DELETE ${r.status === 'pending_review' ? 'PENDING REVIEW REQUEST' : 'MESSAGE'}: ${r.subject}`,
      value_before: r, value_after: null,
    });
    const { error } = await SB.from('email_messages').delete().eq('id', r.id);
    if (error) { flash(`Delete failed: ${error.message}`); return; }
    closeEditor();
    setDeletedNotice(false);
    load();
  }

  async function saveDraft() {
    const subject = form.subject.trim();
    if (!subject) { flash('Subject required'); return; }
    if (!form.blocks.length) { flash('Add at least one element'); return; }
    const body_html = blocksToHtml(form.blocks, { subject });
    const body = blocksToText(form.blocks) || subject;
    const payload = { subject, body, body_html, content_json: form.blocks };
    if (sel) {
      await SB.from('email_messages').update(payload).eq('id', sel.id);
    } else {
      const { data } = await SB.from('email_messages').insert({ ...payload, created_by: adminId }).select().single();
      setSel(data);
      setIsNew(false);
    }
    flash('Saved ✓');
    load();
    // Surface the next action (print → sign → send) without a scroll hunt.
    setTimeout(() => gateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }

  function flash(msg) { setBusy(msg); setTimeout(() => setBusy(''), 1800); }

  async function submitForReview(r) {
    if (reviewBusy) return;
    if (!pickedReviewer) { flash('Pick a reviewer first'); return; }
    const name = reviewers.find((rv) => rv.email === pickedReviewer)?.display_name || pickedReviewer;
    if (!confirm(`Submit this draft to ${name} for review?`)) return;
    setReviewBusy(true);
    const { data, error } = await SB.functions.invoke('submit-for-review', { body: { message_id: r.id, reviewer_email: pickedReviewer } });
    setReviewBusy(false);
    if (error || data?.error) {
      flash(`Submit failed: ${data?.error || error.message}`);
      return;
    }
    flash(`Sent to ${data.reviewer} ✓`);
    load();
  }
  async function printForSignature(r) {
    printEmailMessage(r);
    if (r.status === 'draft') {
      await SB.from('email_messages').update({ status: 'pending_signature', pdf_generated_at: new Date().toISOString() }).eq('id', r.id);
      load();
    }
  }
  async function markSigned(r) {
    if (!confirm(`Confirm the printed copy was physically signed by ${signer}. This clears the message to send.`)) return;
    await SB.from('email_messages').update({ status: 'signed', signed_by: signer, signed_at: new Date().toISOString() }).eq('id', r.id);
    load();
  }
  async function send(r) {
    // Bug fix: this guard used to only allow 'signed' (paper-override path).
    // Once digital review shipped, canSend below started allowing 'approved'
    // too, but this early return was never updated — clicking Send on an
    // approved draft silently no-op'd here before any state changed, which
    // read as "nothing happens" with no error and no spinner.
    if (!['approved', 'signed'].includes(r.status) || sendState === 'sending') return;
    if (!confirm('Send this message to all active subscribers now?')) return;
    setSendState('sending');
    setSendMsg('Contacting mail server…');
    const { data, error } = await SB.functions.invoke('send-email', { body: { message_id: r.id } });
    if (error || data?.error) {
      setSendState('error');
      setSendMsg(`Send failed: ${data?.error || error.message}`);
    } else {
      setSendState('sent');
      setSendMsg(`Delivered to ${data.recipient_count} subscriber${data.recipient_count === 1 ? '' : 's'}`);
    }
    load();
  }

  if (missing) {
    return (
      <Card>
        <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, lineHeight: 1.9 }}>
          <div style={{ color: P.gold }}>EMAIL TABLES NOT FOUND</div>
          <div>Run <span style={{ color: P.cream }}>supabase/email_system.sql</span> then <span style={{ color: P.cream }}>supabase/email_builder.sql</span> first.</div>
        </div>
      </Card>
    );
  }

  const editorOpen = sel !== null || isNew;

  // ---- browse mode: message list ----
  if (!editorOpen) {
    return (
      <div style={{ maxWidth: 760 }}>
        <PanelHeader title="MESSAGES" sub={`${rows.length} total`} action={<Btn onClick={newDraft} variant="gold" size="sm">+ NEW MESSAGE</Btn>} />
        {deletedNotice && (
          <Card style={{ marginBottom: sp[3], borderColor: P.red }}>
            <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.red, letterSpacing: '0.08em', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: sp[2] }}>
              <span>REQUEST DELETED — it was removed (possibly from the reviewer side) while you had it open.</span>
              <Btn onClick={() => setDeletedNotice(false)} variant="ghost" size="sm">DISMISS</Btn>
            </div>
          </Card>
        )}
        {rows.length === 0 ? (
          <EmptyState icon="✉" title="NO MESSAGES YET" hint="Build a branded email, print it for the SAI/1SG signature, then send it to every active subscriber." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2] }}>
            {rows.map((r) => {
              const m = STATUS_META[r.status] || STATUS_META.draft;
              return (
                <Card key={r.id} hover style={{ cursor: 'pointer', padding: `${sp[3]}px ${sp[4]}px` }} onClick={() => selectMsg(r)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: sp[3] }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: inter, fontSize: fs.base, color: P.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subject}</div>
                      <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, marginTop: 3 }}>{new Date(r.created_at).toLocaleDateString()}</div>
                    </div>
                    <span style={{ fontFamily: mono, fontSize: fs.tiny, color: m.color, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>{m.label}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ---- editor mode ----
  const status = sel?.status || 'draft';
  const meta = STATUS_META[status];
  const editable = !sel || ['draft', 'changes_requested'].includes(sel.status);
  const canSend = ['approved', 'signed'].includes(sel?.status);

  return (
    <div>
      <PanelHeader
        title={sel ? `MESSAGE · ${meta.label}` : 'NEW MESSAGE'}
        sub="Build → submit for review → send"
        action={
          <div style={{ display: 'flex', gap: sp[2] }}>
            <Btn onClick={closeEditor} variant="ghost" size="sm">‹ ALL MESSAGES</Btn>
            {editable && <Btn onClick={saveDraft} variant="gold" size="sm">SAVE DRAFT</Btn>}
            {sel && isS6 && <Btn onClick={() => deleteMessage(sel)} variant="ghost" size="sm" style={{ color: P.red, borderColor: P.red }}>DELETE</Btn>}
          </div>
        }
      />

      <Card style={{ marginBottom: sp[4] }}>
        <Label>Subject line</Label>
        <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} disabled={!editable} placeholder="What subscribers see in their inbox" />
        {busy && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: busy.includes('failed') || busy.includes('required') || busy.includes('Add') ? P.red : P.green, marginTop: sp[2] }}>{busy}</div>}
      </Card>

      <Card style={{ marginBottom: sp[4] }}>
        {!editable && (
          <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.bright, letterSpacing: '0.1em', marginBottom: sp[3] }}>
            🔒 LOCKED · {meta.label} — content is frozen while a decision is pending or already cleared.
          </div>
        )}
        <EmailBuilder
          blocks={form.blocks}
          onChange={(blocks) => setForm((f) => ({ ...f, blocks }))}
          subject={form.subject}
          messageId={sel?.id}
          disabled={!editable}
        />
      </Card>

      {sel && (
        <Card ref={gateRef} style={{ marginBottom: canOverride ? sp[4] : 0 }}>
          <Label>Review gate</Label>
          <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, lineHeight: 2, marginBottom: sp[4] }}>
            <div style={{ color: ['draft', 'changes_requested'].includes(status) ? P.bright : P.mute }}>1 · SUBMIT FOR REVIEW</div>
            <div style={{ color: status === 'pending_review' ? P.bright : P.mute }}>
              2 · {reviewers.find((rv) => rv.email === sel.assigned_reviewer_email)?.display_name || 'Chosen reviewer'} approves or requests changes
            </div>
            <div style={{ color: canSend ? P.green : P.mute }}>3 · SEND to subscribers</div>
          </div>

          {['draft', 'changes_requested'].includes(status) && reviewers.length > 0 && (
            <div style={{ marginBottom: sp[3] }}>
              <Label>Send to</Label>
              <div style={{ display: 'flex', gap: sp[2], flexWrap: 'wrap' }}>
                {reviewers.map((rv) => (
                  <Btn key={rv.email} variant={pickedReviewer === rv.email ? 'gold' : 'ghost'} size="sm" onClick={() => setPickedReviewer(rv.email)}>
                    {rv.display_name}
                  </Btn>
                ))}
              </div>
            </div>
          )}

          {status === 'changes_requested' && (
            <div style={{ background: P.deep, border: `1px solid ${P.red}`, borderRadius: 6, padding: sp[3], marginBottom: sp[3] }}>
              <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.red, letterSpacing: '0.08em', marginBottom: 6 }}>
                CHANGES REQUESTED{sel.reviewed_by ? ` · ${sel.reviewed_by}` : ''}
              </div>
              <div style={{ fontFamily: inter, fontSize: fs.base, color: P.cream, whiteSpace: 'pre-wrap' }}>{sel.reviewer_feedback}</div>
            </div>
          )}

          {status === 'pending_review' && (
            <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.bright, marginBottom: sp[3] }}>
              ⏳ Awaiting review — submitted {sel.submitted_at ? new Date(sel.submitted_at).toLocaleString() : ''}
            </div>
          )}

          {status === 'approved' && sel.reviewed_by && (
            <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.green, marginBottom: sp[3] }}>
              ✓ Approved by {sel.reviewed_by}{sel.reviewed_at ? ` on ${new Date(sel.reviewed_at).toLocaleString()}` : ''}
            </div>
          )}

          <div style={{ display: 'flex', gap: sp[2], flexWrap: 'wrap', alignItems: 'center' }}>
            {['draft', 'changes_requested'].includes(status) && (
              <Btn onClick={() => submitForReview(sel)} variant="gold" size="sm" disabled={reviewBusy}>
                {reviewBusy ? 'SUBMITTING…' : status === 'changes_requested' ? '↻ RESUBMIT FOR REVIEW' : '① SUBMIT FOR REVIEW'}
              </Btn>
            )}
            <Btn onClick={() => send(sel)} variant={canSend ? 'green' : 'default'} size="sm" disabled={!canSend || sendState === 'sending'}>
              {status === 'sent' ? 'SENT ✓'
                : sendState === 'sending' ? 'SENDING…'
                : canSend ? '③ SEND NOW'
                : '🔒 SEND (locked until approved)'}
            </Btn>
            {sendState === 'sending' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: mono, fontSize: fs.tiny, color: P.bright }}>
                <span className="dispatch-spin" style={{ width: 11, height: 11, border: `2px solid ${P.hair}`, borderTopColor: P.bright, borderRadius: '50%', display: 'inline-block' }} />
                {sendMsg}
              </span>
            )}
            {sendState === 'sent' && <span style={{ fontFamily: mono, fontSize: fs.tiny, color: P.green }}>✓ {sendMsg}</span>}
            {sendState === 'error' && <span style={{ fontFamily: mono, fontSize: fs.tiny, color: P.red }}>✕ {sendMsg}</span>}
          </div>
          <style>{`@keyframes dispatchSpin{to{transform:rotate(360deg)}}.dispatch-spin{animation:dispatchSpin 0.7s linear infinite}`}</style>

          {sel.status === 'sent' && (
            <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.gold, marginTop: sp[3] }}>Sent to {sel.recipient_count} on {new Date(sel.sent_at).toLocaleString()}</div>
          )}
          {sel.send_error && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.red, marginTop: sp[2] }}>Last error: {sel.send_error}</div>}
        </Card>
      )}

      {sel && canOverride && (
        <Card>
          <Label>Paper override</Label>
          <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, lineHeight: 1.8, marginBottom: sp[3] }}>
            Bypass digital review with a wet-signature copy. Use only when the review portal isn't an option.
          </div>

          {status === 'pending_signature' && (
            <div style={{ marginBottom: sp[3] }}>
              <Label>Signed by</Label>
              <div style={{ display: 'flex', gap: sp[2], flexWrap: 'wrap' }}>
                {SIGNERS.map((s) => (
                  <Btn key={s} variant={signer === s ? 'gold' : 'ghost'} size="sm" onClick={() => setSigner(s)}>{s}</Btn>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: sp[2], flexWrap: 'wrap', alignItems: 'center' }}>
            {['draft', 'pending_signature', 'signed'].includes(status) && (
              <Btn onClick={() => printForSignature(sel)} variant="ghost" size="sm">
                {status === 'draft' ? 'PRINT FOR SIGNATURE' : '⟳ REPRINT'}
              </Btn>
            )}
            {status === 'pending_signature' && (
              <Btn onClick={() => markSigned(sel)} variant="gold" size="sm">MARK SIGNED · CLEAR TO SEND</Btn>
            )}
          </div>

          {sel.status === 'signed' && sel.signed_at && (
            <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.green, marginTop: sp[3] }}>Cleared by {sel.signed_by} on {new Date(sel.signed_at).toLocaleString()}</div>
          )}
        </Card>
      )}
    </div>
  );
}
