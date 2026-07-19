import { useState, useEffect } from 'react';
import { supabase as SB } from '../lib/supabaseClient';
import { getTeam } from '../lib/teams';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)', hairStrong: 'rgba(201,169,97,0.5)',
};
const mono = "'JetBrains Mono', monospace";
const PAGE_SIZE = 24;

/**
 * Plain photo gallery for a non-voting team. Reads photos where team=teamId.
 * @param {string} teamId
 * @param {(id:string)=>void} [setActive] enables the "Submit a photo" link
 * @param {boolean} [showSubmit]
 */
export default function TeamGallery({ teamId, setActive, showSubmit = true }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [lightbox, setLightbox] = useState(null);
  const team = getTeam(teamId);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    SB.from('photos').select('*').eq('team', teamId).eq('status', 'live').order('created_at', { ascending: false })
      .then(({ data }) => { if (alive) { setPhotos(data || []); setLoading(false); } });
    return () => { alive = false; };
  }, [teamId]);

  if (loading) return <div style={loadingStyle}>LOADING GALLERY…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, letterSpacing: '0.2em' }}>
          {photos.length} {photos.length === 1 ? 'PHOTO' : 'PHOTOS'} · {team?.label?.toUpperCase()}
        </div>
        {showSubmit && setActive && (
          <button onClick={() => setActive('submit')} style={ghostBtn}>+ SUBMIT A PHOTO</button>
        )}
      </div>

      {!photos.length ? (
        <div style={{ ...loadingStyle, padding: 48 }}>NO PHOTOS YET — BE THE FIRST TO ADD ONE</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {photos.slice(0, visible).map((photo) => (
              <div key={photo.id} style={{ position: 'relative', overflow: 'hidden', background: P.deep, cursor: 'pointer' }} onClick={() => setLightbox(photo)}>
                <img src={photo.thumb_url || photo.photo_url} alt="" loading="lazy"
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', transition: 'transform 0.2s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')} />
                {photo.uploader_name && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(6,16,31,0.9), transparent)', padding: '18px 8px 6px', fontFamily: mono, fontSize: 8, color: P.mute }}>
                    📷 {photo.uploader_name}
                  </div>
                )}
              </div>
            ))}
          </div>
          {visible < photos.length && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button onClick={() => setVisible((v) => v + PAGE_SIZE)} style={ghostBtn}>LOAD MORE ({photos.length - visible})</button>
            </div>
          )}
        </>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(6,16,31,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '92vw', maxHeight: '92vh' }}>
            <img src={lightbox.photo_url} alt="" style={{ maxWidth: '100%', maxHeight: '86vh', objectFit: 'contain', display: 'block' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(6,16,31,0.85)', padding: '10px 16px', fontFamily: mono, fontSize: 10, color: P.gold }}>
              {lightbox.uploader_name ? `📷 ${lightbox.uploader_name}` : (team?.label || 'PHOTO')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const loadingStyle = { textAlign: 'center', padding: 60, fontFamily: mono, fontSize: 10, color: P.mute, letterSpacing: '0.2em' };
const ghostBtn = { background: 'transparent', border: `1px solid ${P.hairStrong}`, color: P.gold, fontFamily: mono, fontSize: 10, letterSpacing: '0.16em', padding: '9px 18px', cursor: 'pointer' };
