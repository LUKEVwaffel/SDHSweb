import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono, inter, fs, sp } from '../theme';
import { Btn, PanelHeader, EmptyState } from '../shared/ui';

// Results for the public /halloween poll (supabase/halloween_poll.sql).
// Suggestions are anonymous and publicly readable (movie + rating +
// timestamp only), so this panel is read + delete only.

export default function HalloweenMoviePollPanel() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await SB
      .from('halloween_movie_suggestions')
      .select('*')
      .order('created_at', { ascending: false });
    setSuggestions(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function delSuggestion(row) {
    if (!confirm('Delete this suggestion permanently?')) return;
    setBusy(row.id);
    await SB.from('halloween_movie_suggestions').delete().eq('id', row.id);
    setBusy('');
    load();
  }

  return (
    <div>
      <PanelHeader
        title="HALLOWEEN MOVIE POLL"
        sub={`${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'}`}
        action={<Btn onClick={load} variant="ghost" size="sm">REFRESH</Btn>}
      />

      {loading ? (
        <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, textAlign: 'center', marginTop: sp[8] }}>LOADING…</div>
      ) : suggestions.length === 0 ? (
        <EmptyState icon="🎬" title="NO SUGGESTIONS YET" hint="Suggestions from the /halloween page appear here." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[3] }}>
          {suggestions.map((r) => (
            <div key={r.id} style={{ background: P.deep, border: `1px solid ${P.hair}`, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
              <div>
                <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream, marginBottom: 4 }}>
                  {r.movie} <span style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.06em' }}>· {r.rating}</span>
                </div>
                <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute, letterSpacing: '0.08em' }}>
                  {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
              <Btn variant="danger" size="sm" disabled={busy === r.id} onClick={() => delSuggestion(r)}>{busy === r.id ? '…' : 'DELETE'}</Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
