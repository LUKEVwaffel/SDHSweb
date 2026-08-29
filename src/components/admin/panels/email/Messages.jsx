import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter, fs, sp } from '../../theme';
import { Btn, Card, Label, Input, PanelHeader, EmptyState } from '../../shared/ui';
import { blocksToHtml, blocksToText } from './emailRender';
import EmailBuilder from './builder/EmailBuilder';
import { starterBlocks } from './builder/blocks';
import { AUDIENCE_GROUPS, resolveAudienceEmails } from '../../../../lib/emailAudience';

const STATUS_META = {
  draft:              { label: 'DRAFT',              color: P.mute },
  pending_review:     { label: 'PENDING REVIEW',     color: P.bright },
  changes_requested:  { label: 'CHANGES REQUESTED',  color: P.red },
  approved:           { label: 'APPROVED · CLEARED', color: P.green },
  sent:               { label: 'SENT',               color: P.gold },
};

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
  const [form, setForm] = useState({ subject: '', blocks: [], testRecipient: '', audienceGroup: 'broadcast' });
  const [busy, setBusy] = useState('');
  const [sendState, setSendState] = useState('idle'); // idle | sending | sent | error
  const [sendMsg, setSendMsg] = useState('');
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

  // The DELETE button is explicit-gated to s6 client-side, defense-in-depth
  // on top of the real backstop (email_messages_all_s6 RLS + Dashboard.jsx
  // never routing s5 to this panel at all).
  useEffect(() => {
    (async () => {
      const { data } = await SB.from('admin_roles').select('role').eq('email', adminId).maybeSingle();
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
    setForm({ subject: '', blocks: starterBlocks(), testRecipient: '', audienceGroup: 'broadcast' });
    setBusy('');
    setDeletedNotice(false);
    resetSend();
  }
  function selectMsg(r) {
    setSel(r);
    setIsNew(false);
    // A stored recipient_group means the last save was a resolved audience —
    // reopening keeps that selection so re-saving re-resolves fresh names
    // instead of silently reverting to broadcast. A plain recipient_emails
    // with no group (the old single-test-address path) surfaces as the
    // manual override field instead.
    setForm({
      subject: r.subject, blocks: rowToBlocks(r),
      testRecipient: !r.recipient_group ? (r.recipient_emails?.[0] || '') : '',
      audienceGroup: r.recipient_group || 'broadcast',
    });
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
  // an explicit client-side check on top.
  // Logged to change_log BEFORE the delete (same order as EventsPanel.jsx's
  // del()) so the audit row lands even if the delete itself fails partway,
  // and value_before captures the full row for forensic recovery context.
  async function deleteMessage(r) {
    if (!isS6) return;
    const label = r.status === 'pending_review' ? 'this pending review request' : 'this message';
    if (!confirm(`Delete ${label}: "${r.subject}"? This cannot be undone.`)) return;
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
    const testRecipient = form.testRecipient.trim();
    if (testRecipient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testRecipient)) {
      flash('Test recipient is not a valid email'); return;
    }
    const body_html = blocksToHtml(form.blocks, { subject });
    const body = blocksToText(form.blocks) || subject;
    // recipient_emails is otherwise server-only (set by generate_opticsend_drafts());
    // leave opticsend-sourced rows' targeting untouched here. For a hand-built
    // draft: the manual test address wins if set (deliverability testing,
    // no group label), else a picked audience group resolves to a fresh
    // email list at save time, else it's a plain full broadcast.
    const isOpticsend = sel?.source === 'opticsend';
    let targeting = {};
    if (isS6 && !isOpticsend) {
      if (testRecipient) {
        targeting = { recipient_emails: [testRecipient], recipient_group: null };
      } else if (form.audienceGroup !== 'broadcast') {
        let emails;
        try {
          emails = await resolveAudienceEmails(SB, form.audienceGroup);
        } catch (e) {
          flash(`Could not resolve audience: ${e.message}`); return;
        }
        if (!emails.length) { flash('That audience has no emails on file'); return; }
        targeting = { recipient_emails: emails, recipient_group: form.audienceGroup };
      } else {
        targeting = { recipient_emails: null, recipient_group: null };
      }
    }
    const payload = { subject, body, body_html, content_json: form.blocks, ...targeting };
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
  async function send(r) {
    if (r.status !== 'approved' || sendState === 'sending') return;
    const target = r.recipient_emails?.length
      ? `to ${r.recipient_emails.join(', ')}`
      : 'to all active subscribers';
    if (!confirm(`Send this message ${target} now?`)) return;
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
              <span>REQUEST DELETED. It was removed (possibly from the reviewer side) while you had it open.</span>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {r.source === 'opticsend' && (
                          <span style={{ fontFamily: mono, fontSize: 8, color: P.green, letterSpacing: '0.12em', border: `1px solid ${P.green}`, borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>AUTO</span>
                        )}
                        <div style={{ fontFamily: inter, fontSize: fs.base, color: P.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subject}</div>
                      </div>
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
  const meta = STATUS_META[status] || STATUS_META.draft;
  const editable = !sel || ['draft', 'changes_requested'].includes(sel.status);
  const canSend = sel?.status === 'approved';

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
        {sel?.recipient_emails?.length > 0 && (
          <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.green, marginTop: sp[2] }}>
            🎯 {sel.recipient_group ? `TARGETING: ${AUDIENCE_GROUPS.find((g) => g.id === sel.recipient_group)?.label || sel.recipient_group}` : 'TARGETED SEND'} · {sel.recipient_emails.length} recipient{sel.recipient_emails.length === 1 ? '' : 's'} (not the full subscriber list)
          </div>
        )}
        {sel?.source === 'opticsend' && !sel?.recipient_emails?.length && (
          <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.red, marginTop: sp[2] }}>
            ⚠ NO RECIPIENTS ON FILE. Add Raiders cadets' emails in People → Cadet Database before sending.
          </div>
        )}
        {isS6 && editable && sel?.source !== 'opticsend' && (
          <div style={{ marginTop: sp[3] }}>
            <Label>Audience</Label>
            <div style={{ display: 'flex', gap: sp[2], flexWrap: 'wrap' }}>
              {AUDIENCE_GROUPS.map((g) => (
                <Btn
                  key={g.id}
                  variant={form.audienceGroup === g.id ? 'gold' : 'ghost'}
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, audienceGroup: g.id }))}
                >
                  {g.label}
                </Btn>
              ))}
            </div>
            <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, marginTop: sp[1] }}>
              Company / cadet groups resolve to cadet school emails; raider-parent groups resolve to parent emails. Resolved fresh from the roster each time this draft is saved.
            </div>

            <div style={{ marginTop: sp[3] }}>
              <Label>Test recipient override (optional, s6-only)</Label>
              <Input
                value={form.testRecipient}
                onChange={(e) => setForm((f) => ({ ...f, testRecipient: e.target.value }))}
                placeholder="Leave blank to use the audience picked above"
              />
              <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, marginTop: sp[1] }}>
                Set to send ONLY to this address on approval — for deliverability testing. Overrides the audience above; clear it to restore that selection.
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: sp[4] }}>
        {!editable && (
          <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.bright, letterSpacing: '0.1em', marginBottom: sp[3] }}>
            🔒 LOCKED · {meta.label}. Content is frozen while a decision is pending or already cleared.
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
        <Card ref={gateRef} style={{ marginBottom: 0 }}>
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
              ⏳ Awaiting review, submitted {sel.submitted_at ? new Date(sel.submitted_at).toLocaleString() : ''}
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
    </div>
  );
}
