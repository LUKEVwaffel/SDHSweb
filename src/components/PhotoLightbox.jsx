import { useEffect, useRef } from 'react';
import { getPhotoAttribution } from '../lib/photoQueries';

const P = {
  ink: '#06101F', gold: '#C9A961', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.6)', hair: 'rgba(201,169,97,0.22)', hairStrong: 'rgba(201,169,97,0.5)',
};
const mono = "'JetBrains Mono', monospace";

function formatDate(d) {
  if (!d) return null;
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const SWIPE_THRESHOLD = 50; // px — below this, a touch end is a tap, not a swipe

// Shared full-screen photo viewer — was duplicated near-identically across
// Pictures.jsx and TeamGallery.jsx before the /events rework added a third
// consumer, so it's pulled out here. `photos` (optional) is the full list the
// opened photo came from, enabling prev/next browsing without closing and
// re-opening — the array itself does not change identity while the lightbox
// is open, so it's safe as an effect dep.
export default function PhotoLightbox({ photo, photos = [], onClose, onChange, fallbackLabel = 'BATTALION PHOTO' }) {
  const touchStartX = useRef(null);
  const index = photo ? photos.findIndex((p) => p.id === photo.id) : -1;
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < photos.length - 1;

  const goPrev = () => hasPrev && onChange?.(photos[index - 1]);
  const goNext = () => hasNext && onChange?.(photos[index + 1]);

  useEffect(() => {
    if (!photo) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && index > 0) onChange?.(photos[index - 1]);
      else if (e.key === 'ArrowRight' && index >= 0 && index < photos.length - 1) onChange?.(photos[index + 1]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photo, index, photos, onChange, onClose]);

  if (!photo) return null;

  const { primary, secondary } = getPhotoAttribution(photo);
  const uploadDate = formatDateTime(photo.created_at);
  const event = photo.events || null;

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e) {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx > SWIPE_THRESHOLD) goPrev();
    else if (dx < -SWIPE_THRESHOLD) goNext();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(6,16,31,0.95)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ position: 'relative', maxWidth: '92vw', maxHeight: '92vh', width: '100%', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ position: 'relative' }}>
          <img src={photo.photo_url} alt="" style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', display: 'block', margin: '0 auto' }} />

          {hasPrev && (
            <button onClick={goPrev} aria-label="Previous photo" style={{ ...navBtn, left: 8 }}>‹</button>
          )}
          {hasNext && (
            <button onClick={goNext} aria-label="Next photo" style={{ ...navBtn, right: 8 }}>›</button>
          )}
        </div>

        <div style={{
          background: 'rgba(6,16,31,0.9)', border: `1px solid ${P.hair}`, borderTop: 'none',
          padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 10,
          justifyContent: 'space-between', alignItems: 'flex-end',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            {event?.title && (
              <span style={{ fontFamily: mono, fontSize: 10, color: P.cream, letterSpacing: '0.04em' }}>
                {event.title}{event.date ? ` · ${formatDate(event.date)}` : ''}
              </span>
            )}
            {uploadDate && (
              <span style={{ fontFamily: mono, fontSize: 9, color: P.mute }}>Uploaded {uploadDate}</span>
            )}
            {primary ? (
              <span style={{ fontFamily: mono, fontSize: 9, color: P.gold }}>
                {primary}{secondary ? ` · ${secondary}` : ''}
              </span>
            ) : (
              <span style={{ fontFamily: mono, fontSize: 9, color: P.mute }}>{fallbackLabel}</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <a href={photo.photo_url} download style={{ ...actionBtn, textDecoration: 'none' }}>⬇ DOWNLOAD</a>
            <button onClick={onClose} style={actionBtn}>CLOSE</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const navBtn = {
  position: 'absolute', top: '50%', transform: 'translateY(-50%)',
  background: 'rgba(6,16,31,0.72)', border: `1px solid ${P.hairStrong}`, color: P.cream,
  fontSize: 22, lineHeight: 1, width: 40, height: 40, borderRadius: '50%',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const actionBtn = {
  background: 'none', border: `1px solid ${P.hair}`, color: P.mute,
  fontFamily: mono, fontSize: 10, padding: '6px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
};
