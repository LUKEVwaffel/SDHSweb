import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, inter, fs, sp } from '../theme';
import { Btn, PanelHeader, EmptyState } from '../shared/ui';

// Public FAQ submissions (About page → faq_questions, RLS: public insert,
// s6-only read/manage — see faq_questions.sql). New submissions also trigger
// notify-question-submitted (Resend to every admin_roles role='s6' account);
// this panel is the in-DISPATCH side, same as PhotoSubmissions is for photos.
// REPLY sends the typed answer directly to submitter_email (now required)
// via answer-faq-question and marks the row answered — the only path to
// that status, since there's no value in "answered" without the reply.
const STATUS_TONE = { new: P.red, reviewed: P.gold, answered: P.green };

const FILTERS = [
  { id: 'all',      label: 'ALL' },
  { id: 'new',      label: 'NEW' },
  { id: 'reviewed', label: 'REVIEWED' },
  { id: 'answered', label: 'ANSWERED' },
];

export default function QuestionsPanel() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [replyOpen, setReplyOpen] = useState('');
  const [drafts, setDrafts] = useState({});
  const [sendErr, setSendErr] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await SB.from('faq_questions').select('*').order('submitted_at', { ascending: false });
    setRows(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setStatus(row, status) {
    setBusy(row.id);
    await SB.from('faq_questions').update({ status }).eq('id', row.id);
    setBusy('');
    load();
  }

  async function del(row) {
    if (!confirm('Delete this submitted question permanently?')) return;
    setBusy(row.id);
    await SB.from('faq_questions').delete().eq('id', row.id);
    setBusy('');
    load();
  }

  function toggleReply(row) {
    setReplyOpen((cur) => (cur === row.id ? '' : row.id));
    setSendErr((e) => ({ ...e, [row.id]: '' }));
  }

  async function sendAnswer(row) {
    const answer_text = (drafts[row.id] || '').trim();
    if (!answer_text) { setSendErr((e) => ({ ...e, [row.id]: 'Write an answer first.' })); return; }
    setBusy(row.id);
    setSendErr((e) => ({ ...e, [row.id]: '' }));
    const { data, error } = await SB.functions.invoke('answer-faq-question', {
      body: { question_id: row.id, answer_text },
    });
    setBusy('');
    if (error || data?.error) {
      setSendErr((e) => ({ ...e, [row.id]: data?.error || error.message || 'Send failed.' }));
      return;
    }
    if (data?.emailSent === false) {
      setSendErr((e) => ({ ...e, [row.id]: `Answer saved but email did not send (${data.error || 'unknown error'}).` }));
    } else {
      setReplyOpen('');
    }
    setDrafts((d) => ({ ...d, [row.id]: '' }));
    load();
  }

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.status === filter);
  const counts = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});

  return (
    <div>
      <PanelHeader title="FAQ QUESTIONS · SUBMITTED" sub={`${rows.length} total · public submissions from the About page`} action={<Btn onClick={load} variant="ghost" size="sm">REFRESH</Btn>} />

      <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[4], flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <Btn key={f.id} variant={filter === f.id ? 'gold' : 'ghost'} size="sm" onClick={() => setFilter(f.id)}>
            {f.label}{f.id !== 'all' && counts[f.id] ? ` · ${counts[f.id]}` : ''}
          </Btn>
        ))}
      </div>

      {loading ? (
        <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, textAlign: 'center', marginTop: sp[8] }}>LOADING…</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="?" title="NO QUESTIONS HERE YET" hint="Questions submitted from the About page FAQ box appear here." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[3] }}>
          {filtered.map((r) => (
            <div key={r.id} style={{ background: P.deep, border: `1px solid ${P.hair}`, padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: sp[3] }}>
                <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream, lineHeight: 1.5, maxWidth: 640 }}>{r.question}</div>
                <span style={{ fontFamily: mono, fontSize: 9, color: STATUS_TONE[r.status] || P.mute, letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>
                  {r.status.toUpperCase()}
                </span>
              </div>
              <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute, marginTop: 8, letterSpacing: '0.08em' }}>
                {r.submitter_name || 'Anonymous'} · {r.submitter_email} · {new Date(r.submitted_at).toLocaleString()}
              </div>

              {r.status === 'answered' && r.answer_text && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: P.ink, border: `1px solid ${P.hair}` }}>
                  <div style={{ fontFamily: mono, fontSize: 9, color: P.green, letterSpacing: '0.14em', marginBottom: 6 }}>
                    ANSWERED{r.answered_by ? ` · ${r.answered_by}` : ''}{r.answered_at ? ` · ${new Date(r.answered_at).toLocaleString()}` : ''}
                  </div>
                  <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{r.answer_text}</div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                {r.status !== 'reviewed' && r.status !== 'answered' && <Btn variant="ghost" size="sm" disabled={busy === r.id} onClick={() => setStatus(r, 'reviewed')}>MARK REVIEWED</Btn>}
                {r.status !== 'answered' && <Btn variant="green" size="sm" disabled={busy === r.id} onClick={() => toggleReply(r)}>{replyOpen === r.id ? 'CANCEL' : 'REPLY'}</Btn>}
                <Btn variant="danger" size="sm" disabled={busy === r.id} onClick={() => del(r)}>{busy === r.id ? '…' : 'DELETE'}</Btn>
              </div>

              {replyOpen === r.id && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea
                    value={drafts[r.id] || ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                    placeholder={`Write your answer, this is emailed directly to ${r.submitter_email}…`}
                    rows={4}
                    style={{
                      width: '100%', background: P.ink, border: `1px solid ${P.hair}`, color: P.cream,
                      fontFamily: inter, fontSize: fs.sm, padding: '10px 12px', outline: 'none',
                      boxSizing: 'border-box', resize: 'vertical',
                    }}
                  />
                  {sendErr[r.id] && <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.red }}>{sendErr[r.id]}</div>}
                  <div>
                    <Btn variant="gold" size="sm" disabled={busy === r.id} onClick={() => sendAnswer(r)}>
                      {busy === r.id ? 'SENDING…' : 'SEND ANSWER →'}
                    </Btn>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
