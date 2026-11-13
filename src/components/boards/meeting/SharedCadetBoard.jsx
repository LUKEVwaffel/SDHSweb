import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, RANKS, UNIFORM_DEDUCTIONS, UNIFORM_REQUIRED, uniformScore, totalScore, promotionEligibility, defaultPromotion } from '../../../lib/boardRules';
import { boardApi } from '../boardApi';
import { Modal } from '../ui';
import { readDraft, writeDraft, clearDraft } from './draftRecovery';
import { sharedDraftKey, sharedField, applyPendingFields, newerSharedRow } from './sharedFields';
export default function SharedCadetBoard({ session, cadet, sheet, accountEmail, api, loadQuestions = boardApi.questions, canSave, onActivity, onSharedChange }) {
  const key = sharedDraftKey(accountEmail, session.id, cadet.id, session.active_cadet_revision);
  const recovered = useRef(null);
  if (!recovered.current) { try { recovered.current = readDraft(sessionStorage, key)?.form ?? {}; } catch { recovered.current = {}; } }
  const [row, setRow] = useState(sheet);
  const rowRef = useRef(sheet);
  const [pending, setPending] = useState({});
  const [failed, setFailed] = useState(recovered.current.edits ?? {});
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState([]);
  const [questionError, setQuestionError] = useState('');
  const [note, setNote] = useState(recovered.current.note?.text ?? sheet?.comment ?? '');
  const [noteDirty, setNoteDirty] = useState(!!recovered.current.note && recovered.current.note.text !== (sheet?.comment ?? ''));
  const noteBase = useRef(recovered.current.note?.expected ?? sheet?.comment ?? '');
  const [closing, setClosing] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const mounted = useRef(true), queue = useRef(Promise.resolve());
  const pendingCount = Object.keys(pending).length, failedCount = Object.keys(failed).length;
  const unshared = pendingCount > 0 || failedCount > 0 || noteDirty;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function accept(incoming) { const next = newerSharedRow(rowRef.current, incoming); rowRef.current = next; if (mounted.current) setRow(next); }
  useEffect(() => { accept(sheet); }, [sheet]);
  useEffect(() => {
    setFailed((edits) => Object.fromEntries(Object.entries(edits).filter(([field, edit]) => JSON.stringify(sharedField(row, field)) !== JSON.stringify(edit.value))));
    if (!noteDirty && !pending.comment) setNote(row?.comment ?? '');
  }, [row, noteDirty, pending.comment]);
  useEffect(() => { onActivity?.({ dirty: unshared, busy: pendingCount > 0 || closing }); return () => onActivity?.({ dirty: false, busy: false }); }, [unshared, pendingCount, closing, onActivity]);
  useEffect(() => {
    try {
      if (unshared) writeDraft(sessionStorage, key, { edits: { ...failed, ...pending }, note: noteDirty ? { text: note, expected: noteBase.current } : null }, null);
      else clearDraft(sessionStorage, key);
    } catch { /* Server-confirmed grades do not depend on browser storage. */ }
  }, [unshared, key, pending, failed, note, noteDirty]);
  useEffect(() => { const guard = (e) => { if (unshared || closing) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard); }, [unshared, closing]);
  useEffect(() => { let cancelled = false; loadQuestions(cadet.let_level).then((q) => { if (!cancelled) setQuestions(q); }).catch((e) => { if (!cancelled) setQuestionError(e.message); }); return () => { cancelled = true; }; }, [cadet.let_level, loadQuestions]);
  const form = useMemo(() => applyPendingFields(row, pending), [row, pending]);
  const scores = { ...form.scores, score_uniform: uniformScore(form.uniform) };
  const eligible = form.leader ? { eligible: false, reason: 'Leadership positions receive an evaluation only' } : promotionEligibility({ scores, currentRank: form.rank, letLevel: cadet.let_level });
  const canComplete = form.decision === 'absent' || (CATEGORIES.every((c) => Number.isInteger(scores[c.key])) && !!form.decision && (form.decision !== 'promote' || eligible.eligible));
  const participant = (email) => session.required_signers.find((m) => m.email === email)?.name ?? 'Company leadership';
  const disabled = (field) => !canSave || !row?.id || closing || !!pending[field];
  function change(field, value, expected = sharedField(rowRef.current, field)) {
    if (!canSave || closing || !rowRef.current?.id || pending[field]) return;
    const edit = { value, expected };
    setPending((p) => ({ ...p, [field]: edit })); setFailed((p) => { const next = { ...p }; delete next[field]; return next; }); setError('');
    queue.current = queue.current.then(async () => {
      try {
        const saved = await api.patchField(session.id, cadet.id, session.active_cadet_revision, field, value, expected);
        if (!mounted.current) return;
        accept(saved);
        if (field === 'comment') { setNoteDirty(false); setNote(saved.comment ?? ''); }
      } catch (e) { if (mounted.current) { setFailed((p) => ({ ...p, [field]: edit })); setError(e.message); } }
      finally { if (mounted.current) { setPending((p) => { const next = { ...p }; delete next[field]; return next; }); onSharedChange(true); } }
    });
  }
  async function finish() {
    if (unshared || closing || !canSave) return; setClosing(true); setError('');
    try { await api.finishCadet(session.id, cadet.id, session.active_cadet_revision, rowRef.current.revision); await onSharedChange(true); }
    catch (e) { if (mounted.current) setError(e.message); await onSharedChange(true); }
    finally { if (mounted.current) setClosing(false); }
  }
  async function pause() {
    if (unshared || closing || !canSave) return; setClosing(true); setError('');
    try { await api.pauseCadet(session.id, cadet.id, session.active_cadet_revision); await onSharedChange(true); }
    catch (e) { if (mounted.current) setError(e.message); await onSharedChange(true); }
    finally { if (mounted.current) { setClosing(false); setPauseOpen(false); } }
  }
  function discardUnshared() { setFailed({}); setNote(rowRef.current?.comment ?? ''); setNoteDirty(false); setError(''); }
  return <>
    <div className="bm-hero"><div><div className="tb-eyebrow">{session.company} company · Shared cadet board</div><h1>{cadet.name}</h1><p className="bm-muted">LET {cadet.let_level} · Opened by {participant(session.active_cadet_started_by)}. CO, XO, and 1SG take turns asking questions and agree on one shared sheet.</p></div><span className="bm-badge">{totalScore(scores)} / 20 points</span></div>
    <div className="bm-shared-status" role="status">{!canSave ? 'Reconnecting—grading is paused until changes can be shared.' : pendingCount ? 'Sharing your changes…' : failedCount ? 'Some changes have not been shared.' : 'One shared sheet · Changes are saved for all three leaders'}{row?.updated_by && <span>Last updated by {participant(row.updated_by)}</span>}</div>
    {(error || failedCount > 0) && <div className="tb-banner tb-banner--error" role="alert">{error || 'Recovered changes that were not confirmed as shared.'}<div className="bm-session-controls"><button type="button" className="tb-btn" disabled={!canSave || pendingCount > 0} onClick={() => Object.entries(failed).forEach(([field, edit]) => change(field, edit.value, edit.expected))}>Retry unshared changes</button><button type="button" className="tb-btn" disabled={pendingCount > 0} onClick={discardUnshared}>Use the current shared values</button></div></div>}
    <div className="bm-shared-board">
      <section className="bm-panel bm-shared-questions"><h2>Questions & correct answers</h2><p className="bm-muted">Take turns. Each leader asks one JROTC question and one class question. Cadets answer aloud; all three leaders grade collaboratively.</p>{questionError && <p role="alert">{questionError}</p>}{['jrotc', 'class'].map((category) => <section key={category}><h3>{category === 'jrotc' ? 'JROTC knowledge' : 'Class knowledge'}</h3>{!questions.some((q) => q.category === category) && <p className="bm-muted">This LET section has not been supplied yet. Scoring practice remains available.</p>}{questions.filter((q) => q.category === category).map((q) => <article className="bm-question" key={q.id}><b>{q.question}</b><p>Correct answer: {q.answer}</p></article>)}</section>)}</section>
      <div className="bm-shared-grading"><section className="bm-panel"><h2>Shared grading</h2><div className="bm-form"><label>Current rank for this practice sheet<select value={form.rank} disabled={disabled('rank_before')} onChange={(e) => change('rank_before', e.target.value)}>{RANKS.map((r) => <option key={r.code} value={r.code}>{r.code} · {r.name}</option>)}</select></label><label>Uniform worn<select value={form.uniform.mode} disabled={disabled('uniform.mode')} onChange={(e) => change('uniform.mode', e.target.value)}><option value="">Choose uniform</option><option value="class_a">Class A</option><option value="khaki_polo">Khakis and polo</option></select></label></div>
      {form.uniform.mode === 'khaki_polo' && <label className="bm-check"><input type="checkbox" checked={form.uniform.noIssuedUniform} disabled={disabled('uniform.noIssuedUniform')} onChange={(e) => change('uniform.noIssuedUniform', e.target.checked)} />No uniform has been issued to this cadet (9 points)</label>}
      {form.uniform.mode === 'class_a' && <details><summary>Uniform inspection · {scores.score_uniform} / 9</summary><p className="bm-small">A missing required item gives zero uniform points.</p>{UNIFORM_REQUIRED.map(([k, label]) => <label className="bm-check" key={k}><input type="checkbox" checked={form.uniform.missing.includes(k)} disabled={disabled(`uniform.missing.${k}`)} onChange={(e) => change(`uniform.missing.${k}`, e.target.checked)} />Missing {label}</label>)}<p className="bm-small">Mark crooked, missing, wrong placement, or wrong color.</p>{UNIFORM_DEDUCTIONS.map(([k, label, n]) => <label className="bm-check" key={k}><input type="checkbox" checked={form.uniform.infractions.includes(k)} disabled={disabled(`uniform.infractions.${k}`)} onChange={(e) => change(`uniform.infractions.${k}`, e.target.checked)} />{label} (−{n})</label>)}</details>}
      {CATEGORIES.map((c) => <div className="bm-score-row" key={c.key}><div><b>{c.label}</b><small>{c.sub}</small></div>{c.key === 'score_uniform' ? <b>{scores.score_uniform ?? '—'} / 9</b> : <div className="bm-score-choices" role="group" aria-label={c.label}>{Array.from({ length: c.max + 1 }, (_, n) => <button type="button" key={n} disabled={disabled(c.key)} aria-pressed={scores[c.key] === n} onClick={() => change(c.key, n)}>{n}</button>)}</div>}</div>)}
      </section><section className="bm-panel"><h2>Agreed board decision</h2><label className="bm-check"><input type="checkbox" checked={form.leader} disabled={disabled('leadership_position') || cadet.leadership_position} onChange={(e) => change('leadership_position', e.target.checked)} />Holds a leadership position (evaluation only)</label><div className="bm-form"><label>Board decision<select value={form.decision} disabled={disabled('decision')} onChange={(e) => change('decision', e.target.value)}><option value="">Choose decision</option><option value="promote" disabled={!eligible.eligible}>Promote one rank</option><option value="no_promote">Do not promote</option><option value="absent">Absent</option></select></label>{form.decision === 'promote' && <p>Agreed new rank: <b>{form.target || defaultPromotion(form.rank, cadet.let_level)}</b></p>}{!eligible.eligible && <p className="bm-small">{eligible.reason}</p>}<label>Board comment (optional)<textarea className="tb-textarea" maxLength={2000} value={note} disabled={!!pending.comment || closing} onChange={(e) => { if (!noteDirty) noteBase.current = rowRef.current?.comment ?? ''; setNote(e.target.value); setNoteDirty(e.target.value !== (rowRef.current?.comment ?? '')); }} /></label>{noteDirty && <><p className="bm-small">Your note is local until you share it. Current shared note: {row?.comment || 'No note'}</p><button type="button" className="tb-btn" disabled={disabled('comment')} onClick={() => change('comment', note, noteBase.current)}>Share note</button>{failed.comment && <button type="button" className="bm-text-button" disabled={disabled('comment')} onClick={() => { noteBase.current = rowRef.current?.comment ?? ''; change('comment', note, noteBase.current); }}>Replace the displayed shared note with my note</button>}<button type="button" className="bm-text-button" onClick={() => { setNote(rowRef.current?.comment ?? ''); setNoteDirty(false); setFailed((p) => { const n = { ...p }; delete n.comment; return n; }); }}>Discard my unshared note</button></>}
      <p className="bm-small">Agree on the shared scores before completing. Completion returns all three screens to the company roster.</p><button type="button" className="tb-btn tb-btn--gold tb-btn--lg" disabled={!canSave || !canComplete || unshared || closing} onClick={finish}>{closing ? 'Finishing…' : 'Complete cadet & return everyone to roster'}</button><button type="button" className="tb-btn" disabled={!canSave || unshared || closing} onClick={() => setPauseOpen(true)}>Pause this cadet’s board</button></div></section></div>
    </div>
    {pauseOpen && <Modal label="Pause shared cadet board" onClose={closing ? undefined : () => setPauseOpen(false)}><h2>Pause {cadet.name}’s board?</h2><p className="bm-muted">All three screens will return to the roster. Shared grades are retained so this cadet can resume later. Make sure the others have finished sharing their changes.</p>{error && <p role="alert">{error}</p>}<div className="bm-session-controls"><button type="button" className="tb-btn" disabled={closing} onClick={() => setPauseOpen(false)}>Keep grading</button><button type="button" className="tb-btn tb-btn--gold" disabled={closing || !canSave || unshared} onClick={pause}>Pause for everyone</button></div></Modal>}
  </>;
}
