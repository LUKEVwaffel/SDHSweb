import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, RANKS, uniformScore, UNIFORM_DEDUCTIONS, UNIFORM_REQUIRED, totalScore, promotionEligibility, promotionOptions } from '../../../lib/boardRules';
import { Modal } from '../ui';
import { boardApi } from '../boardApi';
import { clearDraft, draftKey, readDraft, writeDraft, normalizePracticeForm, recoverPracticeForm } from './draftRecovery';
import { meetingApi } from './meetingApi';
export default function PracticeSheet({ session, cadet, sheet, accountEmail, api = meetingApi, loadQuestions = boardApi.questions, canSave = true, onActivity, onClose, onSaved }) {
  const storageKey = draftKey(accountEmail, session.id, cadet.id);
  const initial = useRef(null);
  if (!initial.current) {
    const server = normalizePracticeForm({ ...sheet, rank: sheet?.rank_before ?? cadet.cadet_rank ?? 'PVT', leader: sheet?.leadership_position ?? cadet.leadership_position ?? false });
    let recovered = null;
    try { recovered = recoverPracticeForm(server, readDraft(sessionStorage, storageKey)); } catch { /* session storage may be disabled */ }
    initial.current = { server, recovered, form: recovered ? normalizePracticeForm(recovered.form) : server };
  }
  const baseRevision = useRef(initial.current.recovered ? initial.current.recovered.baseRevision : sheet?.revision ?? null);
  const committed = useRef(false);
  const [scores, setScores] = useState(initial.current.form.scores);
  const [uniform, setUniform] = useState(initial.current.form.uniform);
  const [rank, setRank] = useState(initial.current.form.rank);
  const [leader, setLeader] = useState(initial.current.form.leader);
  const [decision, setDecision] = useState(initial.current.form.decision);
  const [target, setTarget] = useState(initial.current.form.target);
  const [comment, setComment] = useState(initial.current.form.comment);
  const [questions, setQuestions] = useState([]);
  const [questionError, setQuestionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [discardOpen, setDiscardOpen] = useState(false);
  const [tab, setTab] = useState('sheet');
  useEffect(() => {
    let cancelled = false;
    loadQuestions(cadet.let_level).then((data) => { if (!cancelled) setQuestions(data); }).catch((e) => { if (!cancelled) setQuestionError(e.message); });
    return () => { cancelled = true; };
  }, [cadet.let_level, loadQuestions]);
  const form = useMemo(() => normalizePracticeForm({ scores, uniform, rank, leader, decision, target, comment }), [scores, uniform, rank, leader, decision, target, comment]);
  const dirty = !committed.current && JSON.stringify(form) !== JSON.stringify(initial.current.server);
  useEffect(() => {
    onActivity?.({ dirty, busy });
    return () => onActivity?.({ dirty: false, busy: false });
  }, [dirty, busy, onActivity]);
  useEffect(() => {
    try {
      if (dirty) writeDraft(sessionStorage, storageKey, form, baseRevision.current);
      else clearDraft(sessionStorage, storageKey);
    } catch { /* explicit server saves remain available */ }
  }, [dirty, form, storageKey]);
  useEffect(() => {
    const guard = (event) => { if (!committed.current && (dirty || busy)) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, busy]);
  function savedLocally() { committed.current = true; try { clearDraft(sessionStorage, storageKey); } catch {} onActivity?.({ dirty: false, busy: false }); }
  const effectiveScores = useMemo(() => ({ ...scores, score_uniform: uniformScore(uniform) }), [scores, uniform]);
  const eligibility = leader ? { eligible: false, reason: 'Leadership positions receive an evaluation only' } : promotionEligibility({ scores: effectiveScores, currentRank: rank, letLevel: cadet.let_level });
  const options = promotionOptions(rank, cadet.let_level);
  const complete = decision === 'absent' || (CATEGORIES.every((c) => Number.isInteger(effectiveScores[c.key])) && decision && (decision !== 'promote' || (eligibility.eligible && options.includes(target))));
  function inspect(field, key) { setUniform((u) => ({ ...u, [field]: u[field].includes(key) ? u[field].filter((x) => x !== key) : [...u[field], key] })); }
  async function save(status) {
    if (busy) return; setBusy(true); setError('');
    try {
      await api.save({ session_id: session.id, cadet_id: cadet.id, expected_revision: baseRevision.current,
        scores: effectiveScores, uniform_inspection: uniform, rank_before: rank, leadership_position: leader,
        decision: decision || null, promote_to: decision==='promote' ? target : null, comment, status });
      savedLocally();
      await onSaved();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function discard() {
    setBusy(true); setError('');
    try { await api.discard(sheet.id, baseRevision.current); savedLocally(); await onSaved(); }
    catch (e) { setError(e.message); setDiscardOpen(false); } finally { setBusy(false); }
  }
  return <>
    {initial.current.recovered && <div className="bm-callout" role="status">Recovered unsaved practice from this tab. Save a draft to share it with your company.</div>}
    {!canSave && <div className="bm-callout" role="status">Waiting for the connection to recover. You can keep editing; your changes are kept on this tab.</div>}
    <button type="button" className="bm-text-button" disabled={busy} onClick={onClose}>← Company roster</button>
    <div className="bm-hero"><div><div className="tb-eyebrow">{session.company} · Practice evaluation</div><h1>{cadet.name}</h1><p className="bm-muted">LET {cadet.let_level ?? 'not recorded'} · This sheet cannot change a real rank.</p></div><span className="bm-badge">{totalScore(effectiveScores)} / 20 points</span></div>
    <div className="bm-tabs" role="tablist"><button role="tab" aria-selected={tab==='sheet'} onClick={() => setTab('sheet')}>Score sheet</button><button role="tab" aria-selected={tab==='questions'} onClick={() => setTab('questions')}>LET {cadet.let_level} questions & answers</button></div>
    {tab==='questions' && <section className="bm-panel"><h2>Questions & correct answers</h2><p className="bm-muted">Each board member asks one question from each section. The cadet answers aloud.</p>{questionError && <p role="alert">{questionError}</p>}{['jrotc','class'].map((category) => <section key={category}><h3>{category==='jrotc'?'JROTC knowledge':'Class knowledge'}</h3>{!questions.some((q) => q.category===category) && <p className="bm-muted">Questions for this section have not been supplied yet. You can still practice the scoring workflow.</p>}<div className="bm-questions">{questions.filter((q) => q.category===category).map((q) => <article className="bm-question" key={q.id}><b>{q.question}</b><p>Correct answer: {q.answer}</p></article>)}</div></section>)}</section>}
    {tab==='sheet' && <div className="bm-editor"><section className="bm-panel">
      <div className="bm-form" style={{ marginTop: 0 }}><label>Current rank for this practice sheet<select value={rank} disabled={busy} onChange={(e) => { setRank(e.target.value); setDecision(''); setTarget(''); }}>{RANKS.map((r) => <option value={r.code} key={r.code}>{r.code} · {r.name}</option>)}</select></label></div>
      <h2>Uniform inspection</h2><div className="bm-form"><label>Uniform worn<select value={uniform.mode} disabled={busy} onChange={(e) => setUniform({ ...uniform, mode: e.target.value })}><option value="">Choose uniform</option><option value="class_a">Class A</option><option value="khaki_polo">Khakis and polo</option></select></label></div>
      {uniform.mode==='khaki_polo' && <label className="bm-check"><input type="checkbox" disabled={busy} checked={uniform.noIssuedUniform} onChange={(e) => setUniform({ ...uniform, noIssuedUniform: e.target.checked })} />No uniform has been issued to this cadet (9 points)</label>}
      {uniform.mode==='class_a' && <details><summary>Mark missing items or uniform infractions · {effectiveScores.score_uniform} / 9</summary><p className="bm-small">Any missing required item gives zero uniform points.</p>{UNIFORM_REQUIRED.map(([k,label]) => <label className="bm-check" key={k}><input type="checkbox" checked={uniform.missing.includes(k)} onChange={() => inspect('missing',k)} disabled={busy} />Missing {label}</label>)}<p className="bm-small">Mark crooked, missing, wrong placement, or wrong color.</p>{UNIFORM_DEDUCTIONS.map(([k,label,n]) => <label className="bm-check" key={k}><input type="checkbox" checked={uniform.infractions.includes(k)} onChange={() => inspect('infractions',k)} disabled={busy} />{label} (−{n})</label>)}</details>}
      {CATEGORIES.map((c) => <div className="bm-score-row" key={c.key}><div><b>{c.label}</b><small>{c.sub}</small></div>{c.key==='score_uniform'?<b>{effectiveScores.score_uniform??'—'} / 9</b>:<div className="bm-score-choices" role="group" aria-label={c.label}>{Array.from({ length:c.max+1 },(_,n) => <button type="button" key={n} disabled={busy} aria-pressed={effectiveScores[c.key]===n} onClick={() => setScores({ ...scores,[c.key]:n })}>{n}</button>)}</div>}</div>)}
    </section><aside className="bm-panel"><h2>Practice decision</h2>
      <label className="bm-check"><input type="checkbox" checked={leader} disabled={busy || cadet.leadership_position} onChange={(e) => { setLeader(e.target.checked); setDecision(''); }} />Holds a leadership position (evaluation only)</label>
      <div className="bm-form"><label>Board decision<select value={decision} disabled={busy} onChange={(e) => { setDecision(e.target.value); if(e.target.value==='promote') setTarget(options[0]??''); }}><option value="">Choose decision</option><option value="promote" disabled={!eligibility.eligible}>Promote one rank</option><option value="no_promote">Do not promote</option><option value="absent">Absent</option></select></label>
      {!eligibility.eligible && <p className="bm-small">{eligibility.reason}</p>}
      {decision==='promote' && <label>New rank<select value={target} onChange={(e) => setTarget(e.target.value)}>{options.map((r) => <option key={r}>{r}</option>)}</select></label>}
      <label>Board comment (optional)<textarea className="tb-textarea" maxLength={2000} value={comment} disabled={busy} onChange={(e) => setComment(e.target.value)} /></label>
      {error && <div className="tb-banner tb-banner--error" role="alert">{error}<button type="button" className="bm-text-button" onClick={onClose}>Return to roster and reload this cadet</button></div>}
      <button type="button" className="tb-btn tb-btn--gold tb-btn--lg" disabled={busy || !complete || !canSave} onClick={() => save('complete')}>{busy?'Saving…':'Complete practice sheet'}</button><button type="button" className="tb-btn" disabled={busy || !canSave} onClick={() => save('draft')}>Save draft</button>
      </div>{sheet && <button type="button" className="bm-text-button" disabled={busy} onClick={() => setDiscardOpen(true)}>Discard this practice sheet</button>}<p className="bm-small">Saved practice is shared with your company’s other leaders. It stays separate from official boards.</p>
    </aside></div>}
    {discardOpen && <Modal label="Discard practice sheet" onClose={busy ? undefined : () => setDiscardOpen(false)}><h2>Discard this practice sheet?</h2><p className="bm-muted">This removes the saved practice for {cadet.name} from this session. Their real cadet record is unaffected.</p><div className="bm-session-controls"><button className="tb-btn" disabled={busy} onClick={() => setDiscardOpen(false)}>Keep sheet</button><button className="tb-btn tb-btn--gold" disabled={busy} onClick={discard}>Discard practice sheet</button></div></Modal>}
  </>;
}
