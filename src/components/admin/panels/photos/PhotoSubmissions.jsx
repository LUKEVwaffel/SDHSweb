import { useState, useEffect, useCallback } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter, fs, sp } from '../../theme';
import { Btn, PanelHeader, EmptyState } from '../../shared/ui';
import TvPhotosPanel from '../tvphotos/TvPhotosPanel';
import TvTerminalManager from '../tvphotos/TvTerminalManager';

// Every public photo submission (PhotoUploader → photos table, bucket
// team-photos) lands here — battalion AND all 4 specialty teams. This is the
// panel that was missing: DISPATCH previously only read `gallery` (curated) and
// raider event photos, so plain team/battalion submissions were invisible.
// When a specific category filter is selected (not ALL) and showTvPhotos is
// set (Luke only), that category's curated TV Photos section (tv_photos
// table — a separate table by design, see TvPhotosPanel.jsx) renders above
// the submissions grid, so both photo pools live in one place per category.
const BUCKET = 'team-photos';

const FILTERS = [
  { id: 'all',       label: 'ALL' },
  { id: 'battalion', label: 'BATTALION' },
  { id: 'raiders',   label: 'RAIDERS' },
  { id: 'rifle',     label: 'RIFLE' },
  { id: 'academic',  label: 'ACADEMIC' },
  { id: 'drill',     label: 'DRILL' },
];

const TEAM_COLOR = {
  battalion: P.bright, raiders: '#7EC87E', rifle: P.gold, academic: '#B48FD4', drill: '#D69B6B',
};

// The thumb is stored alongside the full image as `<base>_t.jpg`.
function thumbPath(storagePath) {
  return storagePath ? storagePath.replace(/\.jpg$/i, '_t.jpg') : null;
}

export default function PhotoSubmissions({ adminId, showTvPhotos = false }) {
  const [rows, setRows] = useState([]);
  const [events, setEvents] = useState({});
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: photos }, { data: evs }] = await Promise.all([
      SB.from('photos').select('*').order('created_at', { ascending: false }),
      SB.from('events').select('id, title'),
    ]);
    setRows(photos || []);
    const map = {};
    for (const e of evs || []) map[e.id] = e.title;
    setEvents(map);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggleHidden(row) {
    const next = row.status === 'hidden' ? 'live' : 'hidden';
    await SB.from('photos').update({ status: next }).eq('id', row.id);
    load();
  }

  async function del(row) {
    if (!confirm('Delete this photo? Removes it from the public gallery and storage permanently.')) return;
    setBusy(row.id);
    // Remove full + thumb from storage, then the row. Storage errors are
    // non-fatal (file may already be gone) — the row delete is what matters.
    const paths = [row.storage_path, thumbPath(row.storage_path)].filter(Boolean);
    if (paths.length) await SB.storage.from(BUCKET).remove(paths);
    await SB.from('photos').delete().eq('id', row.id);
    await SB.from('change_log').insert({
      admin_id: adminId, page: 'photos', element: row.id,
      label: `DELETE PHOTO: ${row.team}${row.uploader_name ? ` · ${row.uploader_name}` : ''}`,
      value_before: row, value_after: null,
    });
    setBusy('');
    load();
  }

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.team === filter);

  const counts = rows.reduce((acc, r) => { acc[r.team] = (acc[r.team] || 0) + 1; return acc; }, {});

  return (
    <div>
      <PanelHeader title="PHOTO SUBMISSIONS · ALL PHOTOS" sub={`${rows.length} total · battalion + specialty teams · public uploads`} action={<Btn onClick={load} variant="ghost" size="sm">REFRESH</Btn>} />

      <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[4], flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <Btn key={f.id} variant={filter === f.id ? 'gold' : 'ghost'} size="sm" onClick={() => setFilter(f.id)}>
            {f.label}{f.id !== 'all' && counts[f.id] ? ` · ${counts[f.id]}` : ''}
          </Btn>
        ))}
      </div>

      {showTvPhotos && filter !== 'all' && (
        <TvPhotosPanel adminId={adminId} folder={filter} />
      )}

      {(showTvPhotos && filter !== 'all') && (
        <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.faint, letterSpacing: '0.14em', marginBottom: sp[3] }}>
          SUBMISSIONS
        </div>
      )}

      {loading ? (
        <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, textAlign: 'center', marginTop: sp[8] }}>LOADING…</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="⊞" title="NO PHOTOS HERE YET" hint="Public submissions from the Submit Photos page appear here, battalion and every specialty team." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: sp[3] }}>
          {filtered.map((r) => {
            const hidden = r.status === 'hidden';
            const color = TEAM_COLOR[r.team] || P.gold;
            const isRaiderVote = r.team === 'raiders' && r.event_id;
            return (
              <div key={r.id} style={{ background: P.deep, border: `1px solid ${P.hair}`, opacity: hidden ? 0.55 : 1 }}>
                <a href={r.photo_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', position: 'relative', aspectRatio: '4/3', background: P.ink, overflow: 'hidden' }}>
                  <img src={r.thumb_url || r.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <span style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(6,16,31,0.82)', color, fontFamily: mono, fontSize: 8, letterSpacing: '0.1em', padding: '3px 6px' }}>
                    {(r.team || '?').toUpperCase()}
                  </span>
                  {hidden && <span style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(6,16,31,0.82)', color: P.mute, fontFamily: mono, fontSize: 8, padding: '3px 6px' }}>HIDDEN</span>}
                </a>
                <div style={{ padding: '7px 9px' }}>
                  <div style={{ fontFamily: inter, fontSize: fs.tiny, color: P.cream, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.uploader_name || 'Anonymous'}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 8, color: P.mute, marginTop: 2 }}>
                    {new Date(r.created_at).toLocaleDateString()}
                    {r.event_id && events[r.event_id] ? ` · ${events[r.event_id]}` : ''}
                  </div>
                  {isRaiderVote && (
                    <div style={{ fontFamily: mono, fontSize: 8, color: P.gold, marginTop: 3 }}>
                      😂 {r.votes_funny} · ✨ {r.votes_aura} · 🎖 {r.votes_team}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    <Btn variant="ghost" size="sm" style={{ fontSize: 8, flex: 1 }} onClick={() => toggleHidden(r)}>{hidden ? 'SHOW' : 'HIDE'}</Btn>
                    <Btn variant="danger" size="sm" style={{ fontSize: 8, flex: 1 }} onClick={() => del(r)} disabled={busy === r.id}>{busy === r.id ? '…' : 'DELETE'}</Btn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showTvPhotos && <TvTerminalManager />}
    </div>
  );
}
