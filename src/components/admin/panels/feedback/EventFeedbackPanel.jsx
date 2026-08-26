import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter, fs, sp, radius } from '../../theme';
import { Btn, Card, Label, Select, PanelHeader, EmptyState, Toast } from '../../shared/ui';

// Cadet/staff event feedback + DISPATCH AI (Beta). S-6-only for now — see
// supabase/event_feedback.sql for why (Luke verifies end-to-end before S-5,
// the actual AAR/feedback owners, get access). Once verified, this panel is
// meant to move under S-5 the same way AarsPanel did, and the ROLE_SECTIONS
// entry in Dashboard.jsx just needs 's5' added.

const FUN_LABELS = ['', 'Rough', 'Meh', 'Decent', 'Fun', 'Best one yet'];

function copyLink(eventId, setMsg) {
  const url = `${window.location.origin}/feedback/${eventId}`;
  navigator.clipboard.writeText(url).then(
    () => setMsg('Link copied — text or post it to cadets.'),
    () => setMsg(url),
  );
}

function AnalysisResult({ run }) {
  const r = run.result || {};
  return (
    <Card style={{ marginBottom: sp[3] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: sp[3] }}>
        <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.1em' }}>
          DISPATCH AI · {new Date(run.generated_at).toLocaleString()}
        </div>
        <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute }}>
          {run.submission_count_analyzed} submission{run.submission_count_analyzed === 1 ? '' : 's'} analyzed
        </div>
      </div>

      {r.summary && (
        <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream, lineHeight: 1.6, marginBottom: sp[4] }}>{r.summary}</div>
      )}

      {r.sentiment && (
        <div style={{ marginBottom: sp[4] }}>
          <Label>Sentiment</Label>
          <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream }}>
            <span style={{
              display: 'inline-block', padding: '3px 10px', marginRight: 8, borderRadius: radius.sm,
              fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.08em', textTransform: 'uppercase',
              background: r.sentiment.overall === 'positive' ? P.green : r.sentiment.overall === 'negative' ? P.red : P.gold,
              color: r.sentiment.overall === 'mixed' ? P.ink : '#fff',
            }}>{r.sentiment.overall}</span>
            {r.sentiment.notes}
          </div>
        </div>
      )}

      {r.safety_flags?.length > 0 && (
        <div style={{ marginBottom: sp[4] }}>
          <Label style={{ color: P.red }}>⚠ Safety / organization flags</Label>
          <ul style={{ margin: 0, paddingLeft: 18, fontFamily: inter, fontSize: fs.sm, color: P.cream, lineHeight: 1.7 }}>
            {r.safety_flags.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {r.themes?.length > 0 && (
        <div style={{ marginBottom: sp[4] }}>
          <Label>Themes</Label>
          {r.themes.map((t, i) => (
            <div key={i} style={{ marginBottom: sp[2], paddingBottom: sp[2], borderBottom: i < r.themes.length - 1 ? `1px solid ${P.hair}` : 'none' }}>
              <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream, fontWeight: 600 }}>
                {t.title} {t.mention_count ? <span style={{ color: P.mute, fontWeight: 400 }}>· {t.mention_count} mentions</span> : null}
              </div>
              <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.mute, lineHeight: 1.5, marginTop: 2 }}>{t.detail}</div>
            </div>
          ))}
        </div>
      )}

      {r.standout_praise?.length > 0 && (
        <div style={{ marginBottom: sp[4] }}>
          <Label style={{ color: P.green }}>Standout praise</Label>
          <ul style={{ margin: 0, paddingLeft: 18, fontFamily: inter, fontSize: fs.sm, color: P.cream, lineHeight: 1.7 }}>
            {r.standout_praise.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {r.recommendations?.length > 0 && (
        <div>
          <Label>Recommendations</Label>
          <ul style={{ margin: 0, paddingLeft: 18, fontFamily: inter, fontSize: fs.sm, color: P.cream, lineHeight: 1.7 }}>
            {r.recommendations.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </Card>
  );
}

function SubmissionRow({ row }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: P.deep, border: `1px solid ${P.hair}`, padding: '12px 16px', marginBottom: sp[2] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <div>
          <span style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream, fontWeight: 600 }}>{row.submitter_name}</span>
          <span style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute, marginLeft: 10, letterSpacing: '0.06em' }}>
            {row.submitter_type.toUpperCase()} · {row.let_level || '—'}{row.company ? ` · ${row.company}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold }}>{'★'.repeat(row.fun_rating || 0)}{'☆'.repeat(5 - (row.fun_rating || 0))} {FUN_LABELS[row.fun_rating]}</span>
          <span style={{ color: P.faint, fontSize: fs.sm }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: sp[3], display: 'flex', flexDirection: 'column', gap: sp[3] }}>
          {[
            ['Went well', row.went_well], ['Needs improvement', row.needs_improvement],
            ['Safety / organization', row.safety_concerns], ['Wants more of', row.want_more_of],
            ['Additional notes', row.additional_notes],
          ].filter(([, v]) => v).map(([label, text]) => (
            <div key={label}>
              <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.06em', marginBottom: 3 }}>{label.toUpperCase()}</div>
              <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{text}</div>
            </div>
          ))}
          <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint }}>{new Date(row.created_at).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}

export default function EventFeedbackPanel() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [rows, setRows] = useState([]);
  const [analysisRuns, setAnalysisRuns] = useState([]);
  const [companyFilter, setCompanyFilter] = useState('all');
  const [letFilter, setLetFilter] = useState('all');
  const [view, setView] = useState('submissions'); // submissions | analysis
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [msg, setMsg] = useState('');

  const loadEvents = useCallback(async () => {
    const { data } = await SB.from('events').select('id,title,date,feedback_enabled')
      .eq('feedback_enabled', true).order('date', { ascending: false });
    setEvents(data || []);
    if (data?.length && !selectedEventId) setSelectedEventId(data[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadEventData = useCallback(async (eventId) => {
    if (!eventId) return;
    setLoading(true);
    const [{ data: fb }, { data: runs }] = await Promise.all([
      SB.from('event_feedback').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
      SB.from('event_feedback_analysis').select('*').eq('event_id', eventId).order('generated_at', { ascending: false }),
    ]);
    setRows(fb || []);
    setAnalysisRuns(runs || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => { setCompanyFilter('all'); setLetFilter('all'); setMsg(''); loadEventData(selectedEventId); }, [selectedEventId, loadEventData]);

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  const companies = useMemo(() => [...new Set(rows.map((r) => r.company).filter(Boolean))].sort(), [rows]);
  const letLevels = useMemo(() => [...new Set(rows.map((r) => r.let_level).filter(Boolean))].sort(), [rows]);

  const filtered = rows.filter((r) =>
    (companyFilter === 'all' || r.company === companyFilter) &&
    (letFilter === 'all' || r.let_level === letFilter)
  );

  async function runAnalysis() {
    if (!selectedEventId || analyzing) return;
    setAnalyzing(true);
    setMsg('');
    const { data, error } = await SB.functions.invoke('analyze-event-feedback', { body: { event_id: selectedEventId } });
    setAnalyzing(false);
    if (error || data?.error) {
      setMsg(data?.error || error?.message || 'Analysis failed.');
      return;
    }
    setView('analysis');
    loadEventData(selectedEventId);
  }

  return (
    <div>
      <PanelHeader
        title="EVENT FEEDBACK"
        sub="DISPATCH AI (Beta) · S-6 only during verification"
        action={selectedEvent && <Btn onClick={() => copyLink(selectedEvent.id, setMsg)} variant="ghost" size="sm">COPY FEEDBACK LINK</Btn>}
      />

      {events.length === 0 ? (
        <EmptyState icon="✎" title="NO EVENTS HAVE FEEDBACK ENABLED" hint="Turn on 'Collect feedback' when creating or editing an event in Events." />
      ) : (
        <>
          <div style={{ marginBottom: sp[4] }}>
            <Label>Event</Label>
            <Select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              options={events.map((ev) => ({ value: ev.id, label: `${ev.title} — ${ev.date}` }))}
              style={{ maxWidth: 420 }}
            />
          </div>

          {msg && <Toast style={{ marginBottom: sp[3] }}>{msg}</Toast>}

          <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[4], flexWrap: 'wrap', alignItems: 'center' }}>
            <Btn variant={view === 'submissions' ? 'gold' : 'ghost'} size="sm" onClick={() => setView('submissions')}>
              SUBMISSIONS{rows.length ? ` · ${rows.length}` : ''}
            </Btn>
            <Btn variant={view === 'analysis' ? 'gold' : 'ghost'} size="sm" onClick={() => setView('analysis')}>
              DISPATCH AI{analysisRuns.length ? ` · ${analysisRuns.length}` : ''}
            </Btn>
            <div style={{ flex: 1 }} />
            <Btn onClick={runAnalysis} variant="green" size="sm" disabled={analyzing || rows.length === 0}>
              {analyzing ? 'ANALYZING…' : 'RUN DISPATCH AI ANALYSIS'}
            </Btn>
          </div>

          {loading ? (
            <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, textAlign: 'center', marginTop: sp[8] }}>LOADING…</div>
          ) : view === 'submissions' ? (
            rows.length === 0 ? (
              <EmptyState icon="✎" title="NO FEEDBACK YET" hint="Share the feedback link with cadets who went on this event." />
            ) : (
              <>
                <div style={{ display: 'flex', gap: sp[3], marginBottom: sp[3], flexWrap: 'wrap' }}>
                  {companies.length > 0 && (
                    <Select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}
                      options={[{ value: 'all', label: 'All companies' }, ...companies.map((c) => ({ value: c, label: c }))]}
                      style={{ width: 200 }} />
                  )}
                  {letLevels.length > 0 && (
                    <Select value={letFilter} onChange={(e) => setLetFilter(e.target.value)}
                      options={[{ value: 'all', label: 'All LET levels' }, ...letLevels.map((l) => ({ value: l, label: l }))]}
                      style={{ width: 180 }} />
                  )}
                </div>
                {filtered.map((r) => <SubmissionRow key={r.id} row={r} />)}
              </>
            )
          ) : analysisRuns.length === 0 ? (
            <EmptyState icon="✦" title="NO DISPATCH AI RUNS YET" hint="Click 'Run DISPATCH AI Analysis' above once feedback has come in." />
          ) : (
            analysisRuns.map((run) => <AnalysisResult key={run.id} run={run} />)
          )}
        </>
      )}
    </div>
  );
}
