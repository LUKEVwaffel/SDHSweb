import { useState, useEffect, useRef, useCallback } from 'react';
import { P, mono, oswald, fs, sp, ease } from '../admin/theme.js';
import { TV_PHOTOS } from '../../lib/tvPhotos.js';

const AUTOPLAY_MS = 8000;
const CROSSFADE_MS = 1400;
const KEN_BURNS_MS = AUTOPLAY_MS + CROSSFADE_MS;

function CarouselStyles() {
  return (
    <style>{`
      .tv-slide-top { transition: opacity ${CROSSFADE_MS}ms ${ease}; }
      @keyframes tvKenBurns { from { transform: scale(1); } to { transform: scale(1.045); } }
      .tv-slide-img { animation: tvKenBurns ${KEN_BURNS_MS}ms ${ease} forwards; }
      @media (prefers-reduced-motion: reduce) {
        .tv-slide-top { transition: none; }
        .tv-slide-img { animation: none; }
      }
    `}</style>
  );
}

function SlideImage({ photo, failed, onError, animate }) {
  if (failed || !photo.src) {
    return (
      <div style={{
        width: '100%', height: '100%', position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: sp[3],
        background: `repeating-linear-gradient(135deg, ${P.deep} 0px, ${P.deep} 12px, ${P.navy} 12px, ${P.navy} 13px)`,
      }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.28 }}>
          <rect x="6" y="10" width="36" height="28" rx="2" stroke={P.gold} strokeWidth="1.2" />
          <circle cx="17" cy="20" r="3.5" stroke={P.gold} strokeWidth="1.2" />
          <path d="M6 32 L17 22 L26 30 L34 20 L42 30" stroke={P.gold} strokeWidth="1.2" fill="none" />
        </svg>
        <span style={{ fontFamily: mono, fontSize: 9, color: `${P.gold}66`, letterSpacing: '0.24em' }}>
          AWAITING PHOTO
        </span>
      </div>
    );
  }
  return (
    <img
      key={animate ? photo.src : undefined}
      src={photo.src}
      alt={photo.alt}
      onError={onError}
      className={animate ? 'tv-slide-img' : undefined}
      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
    />
  );
}

/**
 * Full-bleed kiosk carousel. Bottom layer holds the previous photo (static,
 * opaque). Top layer holds the incoming photo and animates opacity 0 -> 1,
 * which reads as a true crossfade without needing the bottom layer to
 * animate too. All photos are preloaded on mount so an 8s-interval autoplay
 * never pops/flashes waiting on a network fetch.
 *
 * `photos` defaults to the hardcoded Raiders set for standalone use; the
 * kiosk passes the control-center-resolved list (see useTvCarouselPhotos)
 * keyed by source so switching sources cleanly remounts instead of racing
 * index against a shrinking/growing array.
 */
export default function TvPhotoCarousel({ photos = TV_PHOTOS }) {
  const slideCount = photos.length;
  const [index, setIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(null);
  const [topVisible, setTopVisible] = useState(true);
  const [failedSrcs, setFailedSrcs] = useState(() => new Set());
  const timerRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    photos.forEach((photo) => {
      const img = new Image();
      img.src = photo.src;
    });
  }, [photos]);

  const advance = useCallback(() => {
    setPrevIndex((_) => index);
    setIndex((i) => (i + 1) % slideCount);
    setTopVisible(false);
  }, [index, slideCount]);

  useEffect(() => {
    if (slideCount <= 1) return;
    timerRef.current = setTimeout(advance, AUTOPLAY_MS);
    return () => clearTimeout(timerRef.current);
  }, [index, advance, slideCount]);

  // After a new index mounts invisible, flip it visible on the next frame
  // so the opacity change is observed as a transition rather than an
  // instant jump-to-final-value.
  useEffect(() => {
    if (topVisible) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => setTopVisible(true));
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [topVisible]);

  const markFailed = useCallback((src) => {
    setFailedSrcs((prev) => new Set(prev).add(src));
  }, []);

  if (slideCount === 0) return null;
  const active = photos[index] ?? photos[0];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: P.navy }}>
      <CarouselStyles />

      {prevIndex !== null && photos[prevIndex] && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }} aria-hidden="true">
          <SlideImage
            photo={photos[prevIndex]}
            failed={failedSrcs.has(photos[prevIndex].src)}
            onError={() => markFailed(photos[prevIndex].src)}
          />
        </div>
      )}

      <div
        className="tv-slide-top"
        style={{ position: 'absolute', inset: 0, zIndex: 2, opacity: topVisible ? 1 : 0, overflow: 'hidden' }}
      >
        <SlideImage
          photo={active}
          failed={failedSrcs.has(active.src)}
          onError={() => markFailed(active.src)}
          animate
        />
      </div>

      {/* Scrim for title legibility */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3,
        background: 'linear-gradient(to top, rgba(6,16,31,0.85) 0%, rgba(6,16,31,0.15) 35%, transparent 55%)',
      }} />

      <div style={{ position: 'absolute', bottom: sp[8], left: sp[8], zIndex: 4, pointerEvents: 'none' }}>
        <div style={{
          fontFamily: mono, fontSize: fs.tiny, color: P.gold, letterSpacing: '0.3em',
          marginBottom: sp[2], textTransform: 'uppercase',
        }}>
          {String(index + 1).padStart(2, '0')} / {String(slideCount).padStart(2, '0')}
        </div>
        <div style={{
          fontFamily: oswald, fontSize: fs.xxl, fontWeight: 600, color: P.cream,
          letterSpacing: '0.02em', textShadow: '0 2px 12px rgba(0,0,0,0.6)',
        }}>
          {active.title}
        </div>
      </div>
    </div>
  );
}
