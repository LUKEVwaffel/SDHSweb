import { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase as SB } from '../../lib/supabaseClient';
import ReviewLogin from './ReviewLogin';
import ForcePasswordChange from './ForcePasswordChange';
import ReviewerPinControl from './ReviewerPinControl';
import './review.css';

// Reviewer portal — deliberately NOT the DISPATCH theme. This is a separate,
// non-admin population (Chief/SAI, Sgt Kaz, 1SGT), so it stays a plain,
// self-explanatory light surface instead of matching the navy/gold admin
// console — polished (real type/palette/motion, see review.css) but simple.
//
// Auth: each reviewer has their own Supabase Auth account (email + password,
// same pattern as the admin accounts). The submit-for-review notification
// email links here with /review?draft=<id> — a plain deep link, not an
// auto-authenticating token. On mount we check for an existing session; if
// none, ReviewLogin collects email+password via signInWithPassword. Either
// way, the session is then checked against email_reviewers (the
// authorization gate — active reviewer yes/no) before showing anything.
//
// Three tabs: Pending (actionable), Sent (read-only history, ALL reviewers
// see ALL approved-or-sent messages per email_review_visibility.sql — count
// only, never the recipient address list; a message that cleared review but
// hasn't gone out yet, including one that failed to send, shows here too so
// it isn't invisible), and My History (this reviewer's own past approve/deny
// decisions + feedback, from email_review_decisions — an append-only log,
// since email_messages.reviewer_feedback gets nulled on every resubmit and
// can't answer "what have I ever said").
function fmtDate(v) {
  return v ? new Date(v).toLocaleString() : '—';
}

export default function ReviewPortal() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [phase, setPhase] = useState('checking'); // checking | login | force-password | ready | error
  const [errorMsg, setErrorMsg] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerEmail, setReviewerEmail] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [hasPin, setHasPin] = useState(false);

  const [rows, setRows] = useState([]);
  const [sentRows, setSentRows] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);

  const [focusId, setFocusId] = useState(null);
  const [open, setOpen] = useState(null); // full row being viewed/decided
  const [openMode, setOpenMode] = useState('pending'); // 'pending' | 'sent' (hides actions)
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');
  const [shake, setShake] = useState(false);
  const [resultFlash, setResultFlash] = useState(null); // 'approve' | 'deny' | null
  const [deletedNotice, setDeletedNotice] = useState(false);
  const shakeTimer = useRef(null);

  const loadAll = useCallback(async () => {
    const [pending, sent, history] = await Promise.all([
      SB.from('email_messages')
        .select('id, subject, body_html, submitted_at, assigned_reviewer_email, created_by')
        .eq('status', 'pending_review')
        .order('submitted_at', { ascending: true }),
      SB.from('email_messages')
        .select('id, subject, body_html, status, sent_at, recipient_count')
        .in('status', ['approved', 'sent'])
        .order('sent_at', { ascending: false, nullsFirst: true }),
      SB.from('email_review_decisions')
        .select('id, decision, feedback, decided_at, subject')
        .order('decided_at', { ascending: false }),
    ]);
    const firstError = pending.error || sent.error || history.error;
    if (firstError) { setPhase('error'); setErrorMsg(firstError.message); return; }
    setRows(pending.data || []);
    setSentRows(sent.data || []);
    setHistoryRows(history.data || []);
    setPhase('ready');
  }, []);

  const verifyReviewerAndLoad = useCallback(async () => {
    const { data: { session } } = await SB.auth.getSession();
    if (!session) { setPhase('login'); return; }

    const { data: rev } = await SB.from('email_reviewers')
      .select('display_name, must_change_password').eq('email', session.user.email.toLowerCase())
      .eq('active', true).maybeSingle();

    if (!rev) {
      setLoginNotice('That account is not an active reviewer.');
      setPhase('login');
      return;
    }

    setReviewerName(rev.display_name);
    setReviewerEmail(session.user.email.toLowerCase());

    // reviewer_has_pin() only ever reads the caller's own JWT email (same
    // safety shape as is_reviewer()) — safe to call before deciding anything.
    const { data: pinFlag } = await SB.rpc('reviewer_has_pin');
    setHasPin(!!pinFlag);

    if (rev.must_change_password) { setPhase('force-password'); return; }
    await loadAll();
  }, [loadAll]);

  async function finishForcePassword() {
    setPhase('checking');
    await loadAll();
  }

  useEffect(() => {
    const draft = searchParams.get('draft');
    if (draft) setFocusId(draft);
    verifyReviewerAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => clearTimeout(shakeTimer.current), []);

  function openPending(row) {
    setOpen(row);
    setOpenMode('pending');
    setFeedback('');
    setFlash('');
    setDeletedNotice(false);
  }

  function openSent(row) {
    setOpen(row);
    setOpenMode('sent');
    setDeletedNotice(false);
  }

  // supabase-js's functions.invoke() does NOT surface the edge function's
  // JSON error body on a non-2xx response — `data` is null and `error` is a
  // FunctionsHttpError whose .message is the fixed generic string "Edge
  // Function returned a non-2xx status code". The real { error: "..." } body
  // only lives on error.context, an unread Response — must be parsed here.
  async function invokeErrorMessage(data, error) {
    if (data?.error) return data.error;
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      if (body?.error) return body.error;
    }
    return error?.message || 'Unknown error';
  }

  // A stale/reused link or a race with the admin side (or another reviewer)
  // deciding/deleting the same request lands here as a 404/409 from the edge
  // function — surface it as a plain "gone" state, not a raw error string.
  function isGoneError(msg) {
    return /not found|no longer pending review|already gone/i.test(msg);
  }

  async function decide(decision) {
    if (!open) return;
    if (decision === 'deny' && !feedback.trim()) {
      setFlash('Feedback is required to request changes.');
      setShake(true);
      clearTimeout(shakeTimer.current);
      shakeTimer.current = setTimeout(() => setShake(false), 420);
      return;
    }
    setBusy(true);
    setFlash('');
    const { data, error } = await SB.functions.invoke('submit-review-decision', {
      body: { message_id: open.id, decision, feedback: feedback.trim() || undefined },
    });
    setBusy(false);
    if (error || data?.error) {
      const msg = await invokeErrorMessage(data, error);
      if (isGoneError(msg)) {
        setOpen(null);
        setDeletedNotice(true);
        loadAll();
        return;
      }
      setFlash(`Failed: ${msg}`);
      return;
    }
    setResultFlash(decision);
    setTimeout(() => {
      setOpen(null);
      setResultFlash(null);
      loadAll();
    }, 480);
  }

  async function deleteRequest() {
    if (!open) return;
    if (!confirm(`Delete this pending request: "${open.subject}"? This cannot be undone.`)) return;
    setBusy(true);
    setFlash('');
    const { data, error } = await SB.functions.invoke('delete-review-request', {
      body: { message_id: open.id },
    });
    setBusy(false);
    if (error || data?.error) {
      const msg = await invokeErrorMessage(data, error);
      if (isGoneError(msg)) {
        setOpen(null);
        setDeletedNotice(true);
        loadAll();
        return;
      }
      setFlash(`Delete failed: ${msg}`);
      return;
    }
    setOpen(null);
    setDeletedNotice(true);
    loadAll();
  }

  const shell = (children) => (
    <div className="rv">
      <div className="rv-shell">
        <div className="rv-eyebrow">Trojan Battalion &middot; Email Review</div>
        {children}
      </div>
    </div>
  );

  if (phase === 'checking') return shell(<p className="rv-sub"><span className="rv-dot" />Checking your session&hellip;</p>);

  if (phase === 'login') return shell(
    <ReviewLogin notice={loginNotice} onSignedIn={verifyReviewerAndLoad} />
  );

  if (phase === 'force-password') return shell(
    <ForcePasswordChange email={reviewerEmail} onDone={finishForcePassword} />
  );

  if (phase === 'error') return shell(
    <div className="rv-panel" style={{ borderColor: '#dcbdb6' }}>
      <h1 className="rv-h1" style={{ fontSize: 20, color: 'var(--rv-red)' }}>Something went wrong</h1>
      <p className="rv-sub" style={{ marginTop: 10 }}>{errorMsg}</p>
    </div>
  );

  if (open) {
    const isPending = openMode === 'pending';
    return shell(
      <div>
        <button className="rv-back" onClick={() => setOpen(null)}>&lsaquo; Back</button>
        <div
          className="rv-panel"
          style={{
            padding: 0, overflow: 'hidden',
            outline: resultFlash === 'approve' ? '2px solid var(--rv-green)' : resultFlash === 'deny' ? '2px solid var(--rv-red)' : 'none',
            outlineOffset: -1,
            transition: 'outline-color 0.2s var(--rv-ease)',
          }}
        >
          <div className="rv-detail-head">
            <h1 className="rv-detail-title">{open.subject}</h1>
            {isPending && open.created_by && (
              <div className="rv-row-meta">Drafted by {open.created_by}</div>
            )}
          </div>
          <iframe
            title="Draft preview"
            sandbox="allow-same-origin"
            srcDoc={open.body_html || '<p style="font-family:sans-serif;color:#888;padding:20px">No HTML body.</p>'}
            className="rv-frame"
          />
          {isPending ? (
            <div className="rv-detail-foot">
              <label className="rv-label">Feedback (required if requesting changes)</label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                className={`rv-textarea${shake ? ' rv-shake' : ''}`}
                placeholder="What needs to change?"
              />
              {flash && <div className="rv-flash">{flash}</div>}
              <div className="rv-actions">
                <button className="rv-btn approve" onClick={() => decide('approve')} disabled={busy}>
                  {busy ? 'Working…' : 'Approve'}
                </button>
                <button className="rv-btn deny" onClick={() => decide('deny')} disabled={busy}>
                  Request changes
                </button>
              </div>
              <button
                className="rv-link"
                style={{ color: 'var(--rv-red)', marginTop: 14 }}
                onClick={deleteRequest}
                disabled={busy}
              >
                Delete this request
              </button>
            </div>
          ) : (
            <div className="rv-detail-foot">
              <div className="rv-row-meta" style={{ fontSize: 12 }}>
                {open.status === 'sent'
                  ? <>Sent {fmtDate(open.sent_at)} &middot; {open.recipient_count ?? '—'} recipient{open.recipient_count === 1 ? '' : 's'}</>
                  : 'Approved · awaiting send'}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Drafts assigned to you (or legacy rows submitted before assignment
  // existed, which really were sent to all 3) show first. Drafts assigned to
  // a different reviewer still show — any active reviewer can act as a
  // fallback — just below, so the default view reads as "yours" without
  // hiding the others entirely.
  const myRows = rows.filter((r) => !r.assigned_reviewer_email || r.assigned_reviewer_email.toLowerCase() === reviewerEmail);
  const otherRows = rows.filter((r) => r.assigned_reviewer_email && r.assigned_reviewer_email.toLowerCase() !== reviewerEmail);

  const tabs = [
    { id: 'pending', label: 'Pending', count: myRows.length },
    { id: 'sent', label: 'Sent', count: sentRows.length },
    { id: 'history', label: 'My History', count: historyRows.length },
  ];
  const tabPath = (id) => (id === 'pending' ? '/review' : `/review/${id}`);
  const tab = location.pathname === '/review/sent' ? 'sent'
    : location.pathname === '/review/history' ? 'history'
    : location.pathname === '/review' ? 'pending'
    : null;
  if (tab === null) return <Navigate to="/review" replace />;

  if (showSettings) return shell(
    <div>
      <button className="rv-back" onClick={() => setShowSettings(false)}>&lsaquo; Back</button>
      <div className="rv-panel">
        <h1 className="rv-h1" style={{ fontSize: 20, marginBottom: 16 }}>Sign-in settings</h1>
        <ReviewerPinControl
          email={reviewerEmail}
          hasPin={hasPin}
          onChange={setHasPin}
        />
      </div>
    </div>
  );

  return shell(
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <h1 className="rv-h1" style={{ fontSize: 22, margin: '4px 0 4px' }}>Hi {reviewerName}</h1>
        <button className="rv-link" style={{ marginTop: 6 }} onClick={() => setShowSettings(true)}>Settings</button>
      </div>
      <p className="rv-sub" style={{ marginBottom: 22 }}>
        {myRows.length} draft{myRows.length === 1 ? '' : 's'} awaiting your review.
      </p>

      {deletedNotice && (
        <div className="rv-panel" style={{ borderColor: 'var(--rv-red)', padding: '12px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: 'var(--rv-red)', fontSize: 13 }}>Request deleted.</span>
          <button className="rv-link" onClick={() => setDeletedNotice(false)}>Dismiss</button>
        </div>
      )}

      <div className="rv-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`rv-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => navigate(tabPath(t.id))}
          >
            {t.label}<span className="rv-tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === 'pending' && (
        <div className="rv-tabpanel" key="pending">
          {myRows.length === 0 && otherRows.length === 0 ? (
            <div className="rv-card rv-empty">Nothing pending right now.</div>
          ) : (
            <>
              {myRows.length === 0 && (
                <div className="rv-card rv-empty">Nothing assigned to you right now.</div>
              )}
              {myRows.length > 0 && (
                <div className="rv-list">
                  {myRows.map((r) => (
                    <button key={r.id} className={`rv-row${r.id === focusId ? ' is-focus' : ''}`} onClick={() => openPending(r)}>
                      <div className="rv-row-title">{r.subject}</div>
                      <div className="rv-row-meta">Submitted {fmtDate(r.submitted_at)}</div>
                    </button>
                  ))}
                </div>
              )}
              {otherRows.length > 0 && (
                <div style={{ marginTop: 22 }}>
                  <div className="rv-sub" style={{ fontSize: 12, marginBottom: 8 }}>
                    Assigned to another reviewer, open only if acting as a fallback.
                  </div>
                  <div className="rv-list">
                    {otherRows.map((r) => (
                      <button key={r.id} className={`rv-row${r.id === focusId ? ' is-focus' : ''}`} onClick={() => openPending(r)}>
                        <div className="rv-row-title">{r.subject}</div>
                        <div className="rv-row-meta">Submitted {fmtDate(r.submitted_at)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'sent' && (
        <div className="rv-tabpanel" key="sent">
          {sentRows.length === 0 ? (
            <div className="rv-card rv-empty">Nothing approved or sent yet.</div>
          ) : (
            <div className="rv-list">
              {sentRows.map((r) => (
                <button key={r.id} className="rv-row" onClick={() => openSent(r)}>
                  <div className="rv-row-title">{r.subject}</div>
                  <div className="rv-row-meta">
                    {r.status === 'sent'
                      ? <>Sent {fmtDate(r.sent_at)} &middot; {r.recipient_count ?? '—'} recipient{r.recipient_count === 1 ? '' : 's'}</>
                      : 'Approved · awaiting send'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="rv-tabpanel" key="history">
          {historyRows.length === 0 ? (
            <div className="rv-card rv-empty">You haven't reviewed anything yet.</div>
          ) : (
            <div className="rv-list">
              {historyRows.map((h) => (
                <div key={h.id} className="rv-card" style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
                    <div className="rv-row-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.subject || 'Message no longer available'}
                    </div>
                    <span className={`rv-chip ${h.decision}`}>
                      {h.decision === 'approve' ? 'Approved' : h.decision === 'delete' ? 'Deleted' : 'Changes requested'}
                    </span>
                  </div>
                  <div className="rv-row-meta">{fmtDate(h.decided_at)}</div>
                  {h.feedback && (
                    <div className="rv-sub" style={{ fontSize: 13, marginTop: 8, marginBottom: 0 }}>&ldquo;{h.feedback}&rdquo;</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
