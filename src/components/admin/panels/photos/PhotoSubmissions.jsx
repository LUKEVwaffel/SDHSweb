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

// Deletes the storage objects + row + audit log entry for one photo.
// Shared by the single-photo delete button and the batch delete action.
async function deletePhotoRecord(row, adminId) {
  const paths = [row.storage_path, thumbPath(row.storage_path)].filter(Boolean);
  if (paths.length) await SB.storage.from(BUCKET).remove(paths);
  await SB.from('photos').delete().eq('id', row.id);
  await SB.from('change_log').insert({
    admin_id: adminId, page: 'photos', element: row.id,
    label: `DELETE PHOTO: ${row.team}${row.uploader_name ? ` · ${row.uploader_name}` : ''}`,
    value_before: row, value_after: null,
  });
}

export default function PhotoSubmissions({ adminId, showTvPhotos = false }) {
  const [rows, setRows] = useState([]);
  const [events, setEvents] = useState({});
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [viewerId, setViewerId] = useState(null);

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

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.team === filter);
  const viewerIndex = filtered.findIndex((r) => r.id === viewerId);
  const viewerRow = viewerIndex >= 0 ? filtered[viewerIndex] : null;

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function closeViewer() {
    setViewerId(null);
  }

  function showAt(index) {
    if (index < 0 || index >= filtered.length) return;
    setViewerId(filtered[index].id);
  }

  // Keyboard controls while the viewer is open: "d" toggles the open photo
  // for batch delete without leaving the viewer, arrows move between photos,
  // Escape closes — all without ever navigating away from this panel.
  useEffect(() => {
    if (!viewerRow) return undefined;
    function onKey(e) {
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        toggleSelect(viewerRow.id);
      } else if (e.key === 'ArrowRight') {
        showAt(viewerIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        showAt(viewerIndex - 1);
      } else if (e.key === 'Escape') {
        closeViewer();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerRow, viewerIndex, filtered.length]);

  // Local-state updates (no full reload) so the grid never collapses to a
  // "LOADING…" placeholder under an action — that collapse was what threw
  // the scroll position back to the top of the panel.
  async function toggleHidden(row) {
    const next = row.status === 'hidden' ? 'live' : 'hidden';
    setBusy(row.id);
    await SB.from('photos').update({ status: next }).eq('id', row.id);
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)));
    setBusy('');
  }

  async function del(row) {
    if (!confirm('Delete this photo? Removes it from the public gallery and storage permanently.')) return;
    setBusy(row.id);
    await deletePhotoRecord(row, adminId);
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setSelected((prev) => { const next = new Set(prev); next.delete(row.id); return next; });
    if (viewerId === row.id) closeViewer();
    setBusy('');
  }

  async function bulkHide(nextStatus) {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    await SB.from('photos').update({ status: nextStatus }).in('id', ids);
    setRows((prev) => prev.map((r) => (selected.has(r.id) ? { ...r, status: nextStatus } : r)));
    setBulkBusy(false);
  }

  async function bulkDelete() {
    const targets = rows.filter((r) => selected.has(r.id));
    if (!targets.length) return;
    if (!confirm(`Delete ${targets.length} photo(s)? Removes them from the public gallery and storage permanently.`)) return;
    setBulkBusy(true);
    await Promise.all(targets.map((row) => deletePhotoRecord(row, adminId)));
    const deletedIds = new Set(targets.map((r) => r.id));
    setRows((prev) => prev.filter((r) => !deletedIds.has(r.id)));
    if (viewerId && deletedIds.has(viewerId)) closeViewer();
    clearSelection();
    setBulkBusy(false);
  }

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

      {selected.size > 0 && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: sp[2],
          background: P.navy, border: `1px solid ${P.gold}`, borderRadius: 6, padding: '8px 12px', marginBottom: sp[3],
        }}>
          <span style={{ fontFamily: mono, fontSize: fs.xs, color: P.gold, letterSpacing: '0.08em' }}>
            {selected.size} SELECTED
          </span>
          <div style={{ display: 'flex', gap: sp[2], marginLeft: 'auto', flexWrap: 'wrap' }}>
            <Btn variant="ghost" size="sm" onClick={() => bulkHide('hidden')} disabled={bulkBusy}>HIDE SELECTED</Btn>
            <Btn variant="ghost" size="sm" onClick={() => bulkHide('live')} disabled={bulkBusy}>SHOW SELECTED</Btn>
            <Btn variant="danger" size="sm" onClick={bulkDelete} disabled={bulkBusy}>{bulkBusy ? '…' : 'DELETE SELECTED'}</Btn>
            <Btn variant="ghost" size="sm" onClick={clearSelection} disabled={bulkBusy}>CLEAR</Btn>
          </div>
        </div>
      )}

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
            const isSelected = selected.has(r.id);
            const color = TEAM_COLOR[r.team] || P.gold;
            const isRaiderVote = r.team === 'raiders' && r.event_id;
            return (
              <div key={r.id} style={{ background: P.deep, border: `1px solid ${isSelected ? P.gold : P.hair}`, opacity: hidden ? 0.55 : 1 }}>
                <button
                  onClick={() => setViewerId(r.id)}
                  style={{ display: 'block', width: '100%', position: 'relative', aspectRatio: '4/3', background: P.ink, overflow: 'hidden', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  <img src={r.thumb_url || r.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <span
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label="Select photo for batch action"
                    onClick={(e) => { e.stopPropagation(); toggleSelect(r.id); }}
                    style={{
                      position: 'absolute', top: 6, left: 6, width: 18, height: 18, borderRadius: 4,
                      background: isSelected ? P.gold : 'rgba(6,16,31,0.75)', border: `1px solid ${isSelected ? P.gold : P.hairStrong}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: isSelected ? P.ink : 'transparent', cursor: 'pointer',
                    }}
                  >
                    ✓
                  </span>
                  <span style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(6,16,31,0.82)', color, fontFamily: mono, fontSize: 8, letterSpacing: '0.1em', padding: '3px 6px' }}>
                    {(r.team || '?').toUpperCase()}
                  </span>
                  {hidden && <span style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(6,16,31,0.82)', color: P.mute, fontFamily: mono, fontSize: 8, padding: '3px 6px' }}>HIDDEN</span>}
                </button>
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
                    <Btn variant="ghost" size="sm" style={{ fontSize: 8, flex: 1 }} onClick={() => toggleHidden(r)} disabled={busy === r.id}>{hidden ? 'SHOW' : 'HIDE'}</Btn>
                    <Btn variant="danger" size="sm" style={{ fontSize: 8, flex: 1 }} onClick={() => del(r)} disabled={busy === r.id}>{busy === r.id ? '…' : 'DELETE'}</Btn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showTvPhotos && <TvTerminalManager />}

      {/* In-panel viewer — never navigates to photo_url directly, so filters,
          scroll position, and the selection set above all stay intact. */}
      {viewerRow && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={closeViewer}
          style={{ position: 'fixed', inset: 0, background: 'rgba(6,16,31,0.92)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: sp[6] }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', gap: sp[3] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: sp[4], flexWrap: 'wrap' }}>
              <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.cream }}>
                {(viewerRow.uploader_name || 'Anonymous')} · {(viewerRow.team || '?').toUpperCase()} · {viewerIndex + 1}/{filtered.length}
                {selected.has(viewerRow.id) && <span style={{ color: P.gold, marginLeft: 8 }}>· SELECTED (d)</span>}
              </div>
              <div style={{ display: 'flex', gap: sp[2] }}>
                <Btn onClick={() => showAt(viewerIndex - 1)} variant="ghost" size="sm" disabled={viewerIndex <= 0}>◀ PREV</Btn>
                <Btn onClick={() => showAt(viewerIndex + 1)} variant="ghost" size="sm" disabled={viewerIndex >= filtered.length - 1}>NEXT ▶</Btn>
                <Btn onClick={() => toggleSelect(viewerRow.id)} variant={selected.has(viewerRow.id) ? 'gold' : 'ghost'} size="sm">{selected.has(viewerRow.id) ? 'UNSELECT (d)' : 'SELECT (d)'}</Btn>
                <Btn onClick={() => toggleHidden(viewerRow)} variant="ghost" size="sm" disabled={busy === viewerRow.id}>{viewerRow.status === 'hidden' ? 'SHOW' : 'HIDE'}</Btn>
                <Btn onClick={() => del(viewerRow)} variant="danger" size="sm" disabled={busy === viewerRow.id}>{busy === viewerRow.id ? '…' : 'DELETE'}</Btn>
                <Btn onClick={closeViewer} variant="gold" size="sm">CLOSE</Btn>
              </div>
            </div>
            <div style={{ background: P.ink, border: `1px solid ${P.hairStrong}`, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={viewerRow.photo_url} alt="" style={{ maxWidth: '88vw', maxHeight: '78vh', objectFit: 'contain', display: 'block' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
