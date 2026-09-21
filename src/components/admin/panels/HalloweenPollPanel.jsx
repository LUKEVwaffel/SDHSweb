import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, inter, fs, sp } from '../theme';
import { Btn, Card, PanelHeader, EmptyState } from '../shared/ui';

// Results for the public /halloween poll (supabase/halloween_poll.sql).
// Votes are anonymous and publicly readable (just choice + timestamp), so
// this panel is read + delete only — same shape as CheckinPanel. Comments
// are on a separate table, admin-only to read (is_admin()).

export default function HalloweenPollPanel() {
  const [votes, setVotes] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [view, setView] = useState('results'); // results | comments

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: v }, { data: c }] = await Promise.all([
      SB.from('halloween_poll_votes').select('*').order('created_at', { ascending: false }),
      SB.from('halloween_poll_comments').select('*').order('created_at', { ascending: false }),
    ]);
    setVotes(v || []);
    setComments(c || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function delComment(row) {
    if (!confirm('Delete this comment permanently?')) return;
    setBusy(row.id);
    await SB.from('halloween_poll_comments').delete().eq('id', row.id);
    setBusy('');
    load();
  }

  const yes = votes.filter((r) => r.choice === 'yes').length;
  const no = votes.filter((r) => r.choice === 'no').length;
  const total = yes + no;
  const yesPct = total ? Math.round((yes / total) * 100) : 0;

  return (
    <div>
      <PanelHeader
        title="HALLOWEEN BASH POLL"
        sub={`${total} vote${total === 1 ? '' : 's'} · ${comments.length} comment${comments.length === 1 ? '' : 's'}`}
        action={<Btn onClick={load} variant="ghost" size="sm">REFRESH</Btn>}
      />

      <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[4] }}>
        <Btn variant={view === 'results' ? 'gold' : 'ghost'} size="sm" onClick={() => setView('results')}>RESULTS</Btn>
        <Btn variant={view === 'comments' ? 'gold' : 'ghost'} size="sm" onClick={() => setView('comments')}>
          IDEAS{comments.length ? ` · ${comments.length}` : ''}
        </Btn>
      </div>

      {loading ? (
        <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, textAlign: 'center', marginTop: sp[8] }}>LOADING…</div>
      ) : view === 'results' ? (
        total === 0 ? (
          <EmptyState icon="🎃" title="NO VOTES YET" hint="Votes from the /halloween page appear here." />
        ) : (
          <Card>
            <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream, marginBottom: 16 }}>
              Do you want a Halloween Bash this year?
            </div>
            {[{ label: 'YES', count: yes, pct: yesPct }, { label: 'NO', count: no, pct: 100 - yesPct }].map((opt) => (
              <div key={opt.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 50, flexShrink: 0, fontFamily: mono, fontSize: fs.micro, color: P.mute, letterSpacing: '0.06em' }}>
                  {opt.label}
                </div>
                <div style={{ flex: 1, height: 16, background: P.ink, border: `1px solid ${P.hair}`, position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${opt.pct}%`, background: P.gold, transition: 'width 0.2s ease' }} />
                </div>
                <div style={{ width: 70, flexShrink: 0, fontFamily: mono, fontSize: fs.micro, color: P.mute, textAlign: 'right' }}>
                  {opt.count} · {opt.pct}%
                </div>
              </div>
            ))}
          </Card>
        )
      ) : comments.length === 0 ? (
        <EmptyState icon="✎" title="NO IDEAS YET" hint="Comments from the /halloween page appear here." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[3] }}>
          {comments.map((r) => (
            <div key={r.id} style={{ background: P.deep, border: `1px solid ${P.hair}`, padding: '14px 18px' }}>
              <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream, lineHeight: 1.5, whiteSpace: 'pre-wrap', maxWidth: 640 }}>
                {r.comment}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute, letterSpacing: '0.08em' }}>
                  {new Date(r.created_at).toLocaleString()}
                </div>
                <Btn variant="danger" size="sm" disabled={busy === r.id} onClick={() => delComment(r)}>{busy === r.id ? '…' : 'DELETE'}</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
