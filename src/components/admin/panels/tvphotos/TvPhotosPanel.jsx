import { useState, useEffect, useRef } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { TEAMS } from '../../../../lib/teams';
import { listTvPhotos, uploadTvPhoto, deleteTvPhoto } from '../../../../lib/tvPhotosFolders';
import { useTvDailySettings } from '../../../../hooks/useTvDailySettings';
import { P, mono, fs, sp, radius } from '../../theme';
import { Btn, PanelHeader, EmptyState } from '../../shared/ui';
import TvSpotlightPushModal from './TvSpotlightPushModal';
import TvTerminalManager from './TvTerminalManager';

const FOLDERS = [...TEAMS.map((t) => ({ id: t.id, label: t.label })), { id: 'battalion', label: 'Battalion' }];

// Upload/organize surface for the 5 TV Photos folders that feed the /tv
// carousel's "Team Photos" mode (see useTvCarouselPhotos.js), plus
// Push-to-TV single-photo spotlight. Luke-only — gated in Dashboard.jsx
// (nav visibility) AND server-side (tv_photos.sql RLS, is_luke()); this
// component assumes it's only ever rendered for that account.
export default function TvPhotosPanel({ adminId }) {
  const [folder, setFolder] = useState(FOLDERS[0].id);
  const [photos, setPhotos] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pushTarget, setPushTarget] = useState(null);
  const [flash, setFlash] = useState('');
  const fileRef = useRef();
  const { settings } = useTvDailySettings();

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [folder]);

  async function load() {
    setPhotos(null);
    const { photos: rows } = await listTvPhotos(folder);
    setPhotos(rows);
  }

  function flashMsg(msg) { setFlash(msg); setTimeout(() => setFlash(''), 2000); }

  async function onPickFile(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      await uploadTvPhoto(folder, file, adminId);
      load();
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(photo) {
    if (!confirm('Remove this photo from the TV Photos folder?')) return;
    await deleteTvPhoto(photo.id, photo.storage_path);
    load();
  }

  async function clearSpotlight() {
    await SB.functions.invoke('push-tv-spotlight', { body: { clear: true } });
    flashMsg('Spotlight cleared ✓');
  }

  const spotlightActive = !!settings?.spotlight_active && !!settings?.spotlight_photo_url;

  return (
    <div style={{ maxWidth: 1040 }}>
      <PanelHeader
        title="TV PHOTOS"
        sub="Feeds the /tv kiosk carousel — battalion + team folders, live-synced, no reload needed."
        action={<Btn onClick={() => fileRef.current.click()} variant="gold" size="sm" disabled={uploading}>{uploading ? 'UPLOADING…' : '+ UPLOAD'}</Btn>}
      />
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickFile} />

      {spotlightActive && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: sp[3], marginBottom: sp[4],
          padding: sp[3], background: 'rgba(201,169,97,0.1)', border: `1px solid ${P.gold}`, borderRadius: radius.md,
        }}>
          <img src={settings.spotlight_photo_url} alt="" style={{ width: 56, height: 40, objectFit: 'cover', borderRadius: 4 }} />
          <div style={{ flex: 1, fontFamily: mono, fontSize: fs.xs, color: P.gold }}>SPOTLIGHT LIVE ON TV NOW</div>
          <Btn onClick={clearSpotlight} variant="ghost" size="sm">CLEAR</Btn>
        </div>
      )}

      <div style={{ display: 'flex', gap: sp[2], marginBottom: sp[4], flexWrap: 'wrap' }}>
        {FOLDERS.map((f) => (
          <Btn key={f.id} variant={folder === f.id ? 'gold' : 'ghost'} size="sm" onClick={() => setFolder(f.id)}>{f.label.toUpperCase()}</Btn>
        ))}
      </div>

      {photos === null ? (
        <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, textAlign: 'center', marginTop: sp[6] }}>LOADING…</div>
      ) : photos.length === 0 ? (
        <EmptyState icon="⊡" title="NO PHOTOS IN THIS FOLDER" hint="Upload photos for this folder — they'll appear on the kiosk carousel automatically when this team is featured." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: sp[2] }}>
          {photos.map((p) => (
            <div key={p.id} style={{ background: P.deep, border: `1px solid ${P.hair}`, display: 'flex', flexDirection: 'column' }}>
              <div style={{ aspectRatio: '4/3', overflow: 'hidden' }}>
                <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <div style={{ padding: '6px 8px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button onClick={() => setPushTarget(p)} style={miniBtn(false, P.gold)}>PUSH TO TV</button>
                <button onClick={() => onDelete(p)} style={miniBtn(false, P.red)}>DEL</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {flash && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.green, marginTop: sp[3] }}>{flash}</div>}

      <TvTerminalManager />

      {pushTarget && (
        <TvSpotlightPushModal
          photo={pushTarget}
          onClose={() => setPushTarget(null)}
          onPushed={() => { setPushTarget(null); flashMsg('Pushed to TV ✓'); }}
        />
      )}
    </div>
  );
}

function miniBtn(active, accent) {
  return {
    background: active ? accent : 'transparent',
    border: `1px solid ${active ? accent : P.hair}`,
    color: active ? P.ink : accent,
    cursor: 'pointer', fontFamily: mono, fontSize: 8, letterSpacing: '0.08em',
    padding: '3px 6px', borderRadius: 3,
  };
}
