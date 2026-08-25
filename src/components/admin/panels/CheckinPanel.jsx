import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, inter, fs, sp } from '../theme';
import { Btn, Card, PanelHeader, EmptyState } from '../shared/ui';
import { QUESTIONS, CAMPAIGN_ID } from '../../../lib/checkinQuestions';

// Luke-only view of site_checkin_responses (RLS: public insert, is_luke()-only
// read/delete — see supabase/site_checkin.sql). Anonymous responses, so this
// is read + aggregate + delete only, no reply flow like QuestionsPanel has.

// Questions with a describeOn box (see checkinQuestions.js) each write to
// their own `<id>_detail` column — pulled into the written-feedback feed
// alongside the general feedback_text box so none of that free text is
// buried in the breakdown view.
const DETAIL_QUESTIONS = QUESTIONS.filter((q) => q.describeOn);

function writtenEntries(r) {
  const entries = [];
  if (r.feedback_text) entries.push({ label: 'General feedback', text: r.feedback_text });
  for (const q of DETAIL_QUESTIONS) {
    const text = r[`${q.id}_detail`];
    if (text) entries.push({ label: q.prompt, text });
  }
  return entries;
}

function QuestionBreakdown({ q, rows }) {
  const total = rows.length;
  const counts = q.options.map((opt) => ({
    ...opt,
    count: rows.filter((r) => r[q.id] === opt.value).length,
  })).sort((a, b) => b.count - a.count);

  return (
    <Card style={{ marginBottom: sp[3] }}>
      <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream, marginBottom: 12 }}>{q.prompt}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {counts.map((opt) => {
          const pct = total ? Math.round((opt.count / total) * 100) : 0;
          return (
            <div key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 160, flexShrink: 0, fontFamily: mono, fontSize: fs.micro, color: P.mute, letterSpacing: '0.04em' }}>
                {opt.label}
              </div>
              <div style={{ flex: 1, height: 14, background: P.ink, border: `1px solid ${P.hair}`, position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: P.gold, transition: 'width 0.2s ease' }} />
              </div>
              <div style={{ width: 46, flexShrink: 0, fontFamily: mono, fontSize: fs.micro, color: P.mute, textAlign: 'right' }}>
                {opt.count} · {pct}%
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function CheckinPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [view, setView] = useState('breakdown'); // breakdown | comments

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await SB.from('site_checkin_responses').select('*').order('submitted_at', { ascending: false });
    setRows(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function del(row) {
    if (!confirm('Delete this response permanently?')) return;
    setBusy(row.id);
    await SB.from('site_checkin_responses').delete().eq('id', row.id);
    setBusy('');
    load();
  }

  const withComments = rows.filter((r) => writtenEntries(r).length > 0);

  return (
    <div>
      <PanelHeader
        title="SITE CHECK-IN"
        sub={`${rows.length} response${rows.length === 1 ? '' : 's'} · campaign ${CAMPAIGN_ID}`}
        action={<Btn onClick={load} variant="ghost" size="sm">REFRESH</Btn>}
      />

      <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[4] }}>
        <Btn variant={view === 'breakdown' ? 'gold' : 'ghost'} size="sm" onClick={() => setView('breakdown')}>BREAKDOWN</Btn>
        <Btn variant={view === 'comments' ? 'gold' : 'ghost'} size="sm" onClick={() => setView('comments')}>
          WRITTEN FEEDBACK{withComments.length ? ` · ${withComments.length}` : ''}
        </Btn>
      </div>

      {loading ? (
        <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, textAlign: 'center', marginTop: sp[8] }}>LOADING…</div>
      ) : rows.length === 0 ? (
        <EmptyState icon="◔" title="NO RESPONSES YET" hint="Responses from the site-wide check-in popup appear here." />
      ) : view === 'breakdown' ? (
        <div>
          {QUESTIONS.map((q) => <QuestionBreakdown key={q.id} q={q} rows={rows} />)}
        </div>
      ) : withComments.length === 0 ? (
        <EmptyState icon="✎" title="NO WRITTEN FEEDBACK YET" hint="Responses that filled in the optional text field appear here." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[3] }}>
          {withComments.map((r) => (
            <div key={r.id} style={{ background: P.deep, border: `1px solid ${P.hair}`, padding: '14px 18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {writtenEntries(r).map((entry, i) => (
                  <div key={i}>
                    <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.06em', marginBottom: 3 }}>
                      {entry.label.toUpperCase()}
                    </div>
                    <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream, lineHeight: 1.5, whiteSpace: 'pre-wrap', maxWidth: 640 }}>
                      {entry.text}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute, letterSpacing: '0.08em' }}>
                  {new Date(r.submitted_at).toLocaleString()}{r.page_path ? ` · on ${r.page_path}` : ''}
                </div>
                <Btn variant="danger" size="sm" disabled={busy === r.id} onClick={() => del(r)}>{busy === r.id ? '…' : 'DELETE'}</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
