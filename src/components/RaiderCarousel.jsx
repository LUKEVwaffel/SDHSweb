import { useState, useEffect, useRef, useCallback } from 'react';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)',
  hairStrong: 'rgba(201,169,97,0.5)',
};
const mono = "'JetBrains Mono', monospace";
const oswald = 'Oswald, sans-serif';

const AUTOPLAY_MS = 5000;
const SLIDE_COUNT = 9;
const SLIDES = Array.from({ length: SLIDE_COUNT }, (_, i) => ({
  src: `/images/raiders/raider-${i + 1}.jpg`,
  alt: `Raiders team photo ${i + 1}`,
}));

function CarouselStyles() {
  return (
    <style>{`
      @keyframes rcFade { from { opacity: 0; } to { opacity: 1; } }
      .rc-slide { animation: rcFade 0.5s ease both; }
      @media (prefers-reduced-motion: reduce) {
        .rc-slide { animation: none; }
      }
    `}</style>
  );
}

function Slide({ slide }) {
  const [failed, setFailed] = useState(false);
  return failed || !slide.src ? (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
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
  ) : (
    <img
      src={slide.src}
      alt={slide.alt}
      onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block' }}
    />
  );
}

export default function RaiderCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  const goTo = useCallback((i) => setIndex(((i % SLIDE_COUNT) + SLIDE_COUNT) % SLIDE_COUNT), []);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setTimeout(next, AUTOPLAY_MS);
    return () => clearTimeout(timerRef.current);
  }, [index, paused, next]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      style={{ position: 'relative' }}
    >
      <CarouselStyles />
      <div
        role="region"
        aria-label="Raiders team photo carousel"
        style={{
          position: 'relative', width: '100%', aspectRatio: '21 / 9',
          minHeight: 260,
          border: `1px solid ${P.hair}`, background: P.navy, overflow: 'hidden',
        }}
      >
        <div key={index} className="rc-slide" style={{ position: 'absolute', inset: 0 }}>
          <Slide slide={SLIDES[index]} />
        </div>

        {/* gradient for label legibility */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(to top, rgba(6,16,31,0.75) 0%, transparent 30%)',
        }} />

        <div style={{
          position: 'absolute', bottom: 14, left: 16,
          fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.24em',
          background: 'rgba(6,16,31,0.6)', padding: '4px 10px', backdropFilter: 'blur(4px)',
        }}>
          {String(index + 1).padStart(2, '0')} / {String(SLIDE_COUNT).padStart(2, '0')}
        </div>

        {/* arrows */}
        <button
          onClick={prev}
          aria-label="Previous photo"
          style={{
            position: 'absolute', top: '50%', left: 12, transform: 'translateY(-50%)',
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(6,16,31,0.6)', border: `1px solid ${P.hair}`, color: P.gold,
            cursor: 'pointer', fontSize: 16, backdropFilter: 'blur(4px)', transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = P.gold)}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = P.hair)}
        >←</button>
        <button
          onClick={next}
          aria-label="Next photo"
          style={{
            position: 'absolute', top: '50%', right: 12, transform: 'translateY(-50%)',
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(6,16,31,0.6)', border: `1px solid ${P.hair}`, color: P.gold,
            cursor: 'pointer', fontSize: 16, backdropFilter: 'blur(4px)', transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = P.gold)}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = P.hair)}
        >→</button>
      </div>

      {/* dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14 }}>
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to photo ${i + 1}`}
            aria-current={i === index}
            style={{
              width: i === index ? 20 : 6, height: 6, padding: 0, border: 'none', cursor: 'pointer',
              background: i === index ? P.gold : P.hairStrong,
              transition: 'width 0.25s, background 0.2s',
            }}
          />
        ))}
      </div>
    </div>
  );
}
