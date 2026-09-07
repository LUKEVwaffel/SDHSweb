import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRaftingPhotos } from '../../hooks/useRaftingPhotos';
import { RAFTING_TITLE, RAFTING_BLURB } from '../../lib/rafting';

// Public "/rafting" - a flat, retrospective gallery of the battalion rafting
// trip. Grid -> full-screen lightbox (arrows / esc / counter). Palette + the
// lightbox mechanics mirror CompGallery.jsx so the two read as one family.

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)',
  hairStrong: 'rgba(201,169,97,0.5)',
};
const mono = "'JetBrains Mono', monospace";
const oswald = 'Oswald, sans-serif';

function navArrow(side) {
  return {
    position: 'absolute', [side]: 12, top: '50%', transform: 'translateY(-50%)',
    background: 'rgba(6,16,31,0.7)', border: `1px solid ${P.hair}`, color: P.gold,
    fontFamily: oswald, fontSize: 32, lineHeight: 1, cursor: 'pointer', padding: '10px 18px',
  };
}

function Lightbox({ photos, index, onClose, onIndex }) {
  const has = index != null && index >= 0 && index < photos.length;

  const step = useCallback((d) => {
    onIndex((cur) => {
      const next = cur + d;
      if (next < 0 || next >= photos.length) return cur;
      return next;
    });
  }, [photos.length, onIndex]);

  useEffect(() => {
    if (!has) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [has, step, onClose]);

  if (!has) return null;
  const photo = photos[index];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(6,16,31,0.94)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        backdropFilter: 'blur(6px)',
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'absolute', top: 16, right: 20, background: 'none', border: `1px solid ${P.hair}`,
          color: P.cream, fontFamily: mono, fontSize: 14, cursor: 'pointer', padding: '6px 12px',
        }}
      >
        ✕ ESC
      </button>

      {index > 0 && (
        <button onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous" style={navArrow('left')}>‹</button>
      )}
      {index < photos.length - 1 && (
        <button onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next" style={navArrow('right')}>›</button>
      )}

      <figure onClick={(e) => e.stopPropagation()} style={{ margin: 0, maxWidth: '100%', maxHeight: '100%', textAlign: 'center' }}>
        <img
          src={photo.url}
          alt={photo.caption || ''}
          style={{ maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain', border: `1px solid ${P.hair}` }}
        />
        <figcaption style={{ marginTop: 10, fontFamily: mono, fontSize: 9, letterSpacing: '0.16em', color: P.mute }}>
          {index + 1} / {photos.length}{photo.caption ? ` · ${photo.caption}` : ''}
        </figcaption>
      </figure>
    </div>
  );
}

function PhotoGrid({ photos, onOpen }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
      {photos.map((p, i) => (
        <button
          key={p.id}
          onClick={() => onOpen(i)}
          style={{
            border: `1px solid ${P.hair}`, background: P.navy, padding: 0, cursor: 'pointer',
            aspectRatio: '1 / 1', overflow: 'hidden', position: 'relative',
          }}
        >
          <img
            src={p.url}
            alt={p.caption || ''}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </button>
      ))}
    </div>
  );
}

const backBtn = {
  background: 'transparent', border: 'none', cursor: 'pointer', color: P.gold,
  fontFamily: mono, fontSize: 10, letterSpacing: '0.28em', padding: '4px 0',
};

export default function RaftingGallery() {
  const navigate = useNavigate();
  const { photos, loading, error } = useRaftingPhotos();
  const [lb, setLb] = useState(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div style={{ background: P.ink, minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 40px 100px' }}>

        <button onClick={() => navigate('/')} style={{ ...backBtn, marginBottom: 22 }}>
          ← HOME
        </button>

        <div style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.38em', opacity: 0.75, marginBottom: 10 }}>
            BATTALION
          </div>
          <h1 style={{ fontFamily: oswald, fontWeight: 700, fontSize: 60, color: P.cream, letterSpacing: '0.02em', margin: 0, lineHeight: 1 }}>
            {RAFTING_TITLE}
          </h1>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute, margin: '16px 0 0', maxWidth: 560 }}>
            {RAFTING_BLURB}
          </p>
          {!loading && !error && photos.length > 0 && (
            <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.2em', color: P.gold, opacity: 0.6, marginTop: 16 }}>
              {photos.length} PHOTO{photos.length === 1 ? '' : 'S'}
            </div>
          )}
        </div>

        {loading && (
          <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, letterSpacing: '0.2em' }}>LOADING…</div>
        )}

        {error && !loading && (
          <div style={{ border: `1px solid ${P.hairStrong}`, background: P.deep, padding: '20px 24px', fontFamily: mono, fontSize: 10, color: P.bright }}>
            COULD NOT LOAD GALLERY: {error}
          </div>
        )}

        {!loading && !error && photos.length === 0 && (
          <div style={{
            border: `1px dashed ${P.hairStrong}`, background: 'rgba(201,169,97,0.03)',
            padding: '40px 28px', fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute,
          }}>
            Photos are being uploaded. Check back soon.
          </div>
        )}

        {!loading && !error && photos.length > 0 && (
          <PhotoGrid photos={photos} onOpen={setLb} />
        )}

        <Lightbox photos={photos} index={lb} onClose={() => setLb(null)} onIndex={setLb} />
      </div>
    </div>
  );
}
