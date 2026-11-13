import { useEffect, useState } from 'react';
import { boardApi } from '../../../boards/boardApi';

export default function BoardQuestionsTab() {
  const [letLevel, setLetLevel] = useState(1);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ category: 'jrotc', question: '', answer: '' });
  useEffect(() => {
    let cancelled = false;
    setRows([]); setError(''); setForm({ category: 'jrotc', question: '', answer: '' });
    boardApi.questions(letLevel).then((data) => { if (!cancelled) setRows(data); }).catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [letLevel]);
  async function save(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await boardApi.saveQuestion({ ...form, let_level: letLevel });
      setRows(await boardApi.questions(letLevel));
      setForm({ category: 'jrotc', question: '', answer: '' });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="tb-card">
    <h2>Questions &amp; correct answers</h2>
    <p>Enter the supplied question bank here. The company screen shows the questions and correct answers for the cadet’s LET level. Cadets answer aloud.</p>
    <label className="tb-field">LET level<select value={letLevel} disabled={busy} onChange={(e) => setLetLevel(Number(e.target.value))}>{[1,2,3,4].map((n) => <option key={n} value={n}>LET {n}</option>)}</select></label>
    {error && <div role="alert" className="tb-banner tb-banner--error">{error}</div>}
    {!rows.length && <p>No questions supplied yet.</p>}
    {rows.map((q) => <article key={q.id} style={{ marginBlock: 20 }}><small>{q.category === 'jrotc' ? 'JROTC' : 'Class knowledge'}</small><p><b>{q.question}</b><br />Correct answer: {q.answer}</p><button type="button" className="tb-btn tb-btn--sm" disabled={busy} onClick={() => setForm(q)}>Edit question</button></article>)}
    <form onSubmit={save} style={{ display: 'grid', gap: 12, marginTop: 24 }}>
      <h3>{form.id ? 'Edit question' : 'Add supplied question'}</h3>
      <label className="tb-field">Section<select value={form.category} disabled={busy} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="jrotc">JROTC knowledge</option><option value="class">Class knowledge</option></select></label>
      <label className="tb-field">Question<textarea className="tb-textarea" required maxLength={2000} value={form.question} disabled={busy} onChange={(e) => setForm({ ...form, question: e.target.value })} /></label>
      <label className="tb-field">Correct answer<textarea className="tb-textarea" required maxLength={4000} value={form.answer} disabled={busy} onChange={(e) => setForm({ ...form, answer: e.target.value })} /></label>
      <button className="tb-btn tb-btn--gold" disabled={busy}>{busy ? 'Saving…' : 'Save question'}</button>
    </form>
  </div>;
}
