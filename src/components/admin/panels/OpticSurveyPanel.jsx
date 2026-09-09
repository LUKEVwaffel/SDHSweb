import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, inter, fs, sp } from '../theme';
import { Btn, Card, PanelHeader, EmptyState } from '../shared/ui';
import { QUESTIONS, TEXT_QUESTIONS, CAMPAIGN_ID } from '../../../lib/opticSurveyQuestions';

// Luke-only view of optic_survey_responses (RLS: public insert, is_luke()-only
// read/delete — see supabase/optic_survey.sql). Anonymous responses, so this
// is read + aggregate + delete only. Same shape as CheckinPanel.

const TEAM_LABEL = { male: 'Male team', coed: 'Coed team', both: 'Both', unsure: 'Not sure' };
const PHONE_LABEL = { iphone: 'iPhone', android: 'Android', other: 'Other' };

function writtenEntries(r) {
  const entries = [];
  for (const q of TEXT_QUESTIONS) {
    const text = r[q.id];
    if (text) entries.push({ label: q.label, text });
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
              <div style={{ width: 200, flexShrink: 0, fontFamily: mono, fontSize: fs.micro, color: P.mute, letterSpacing: '0.04em' }}>
                {opt.label}
              </div>
              <div style={{ flex: 1, height: 14, background: P.ink, border: `1px solid ${P.hair}`, position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: P.gold, transition: 'width 0.2s ease' }} />
              </div>
              <div style={{ width: 52, flexShrink: 0, fontFamily: mono, fontSize: fs.micro, color: P.mute, textAlign: 'right' }}>
                {opt.count} · {pct}%
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Headline: the whole point of this round is "should we run OPTIC again".
function ReturnSummary({ rows }) {
  const total = rows.length;
  if (!total) return null;
  const yes = rows.filter((r) => r.will_return === 'definitely' || r.will_return === 'probably').length;
  const pct = Math.round((yes / total) * 100);
  return (
    <Card style={{ marginBottom: sp[4], border: `1px solid ${P.gold}` }}>
      <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.1em', marginBottom: 6 }}>
        WOULD BRING OPTIC BACK
      </div>
      <div style={{ fontFamily: inter, fontSize: fs.xl, color: P.cream, fontWeight: 600 }}>
        {yes} of {total} · {pct}%
      </div>
      <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute, marginTop: 4 }}>
        answered “definitely” or “probably” on the last question
      </div>
    </Card>
  );
}

export default function OpticSurveyPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [view, setView] = useState('breakdown'); // breakdown | comments

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await SB.from('optic_survey_responses')
      .select('*')
      .eq('campaign_id', CAMPAIGN_ID)
      .order('submitted_at', { ascending: false });
    setRows(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function del(row) {
    if (!confirm('Delete this response permanently?')) return;
    setBusy(row.id);
    await SB.from('optic_survey_responses').delete().eq('id', row.id);
    setBusy('');
    load();
  }

  const withComments = rows.filter((r) => writtenEntries(r).length > 0);

  return (
    <div>
      <PanelHeader
        title="OPTIC SURVEY"
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
        <EmptyState icon="◎" title="NO RESPONSES YET" hint="Parent responses from the /survey page appear here." />
      ) : view === 'breakdown' ? (
        <div>
          <ReturnSummary rows={rows} />
          {QUESTIONS.map((q) => <QuestionBreakdown key={q.id} q={q} rows={rows} />)}
        </div>
      ) : withComments.length === 0 ? (
        <EmptyState icon="✎" title="NO WRITTEN FEEDBACK YET" hint="Responses that filled in an optional text box appear here." />
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
                  {[
                    r.submitter_name || 'Anonymous',
                    TEAM_LABEL[r.raider_team],
                    PHONE_LABEL[r.phone_type],
                    new Date(r.submitted_at).toLocaleString(),
                  ].filter(Boolean).join(' · ')}
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
