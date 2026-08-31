import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase as SB } from '../lib/supabaseClient';
import { RHEA_EVENT_ID } from '../lib/rheaComp';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)',
  hairStrong: 'rgba(201,169,97,0.5)',
};
const mono = "'JetBrains Mono', monospace";

const AUTOPLAY_MS = 5000;
// How many Rhea County comp frames the hero carousel pulls. It's a hero strip,
// not the full gallery (that's /raiders/comp), so cap it — earliest-tagged
// photos first so the run reads in order.
const MAX_SLIDES = 16;

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

function Placeholder({ label }) {
  return (
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
        {label}
      </span>
    </div>
  );
}

function Slide({ slide }) {
  const [failed, setFailed] = useState(false);
  if (failed || !slide?.src) return <Placeholder label="AWAITING PHOTO" />;
  return (
    <img
      src={slide.src}
      alt={slide.alt}
      onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block' }}
    />
  );
}

// Rhea County Raider Competition hero strip. Pulls Luke's own tagged comp
// photos straight from Supabase (same filter as the /raiders/comp gallery:
// source='luke', status='live', tagged to a sub-event) so it stays current as
// more get tagged in /lukepwa — no static files to manage.
export default function RaiderCarousel() {
  const [slides, setSlides] = useState(null); // null = loading, [] = none
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    let alive = true;
    SB.from('photos')
      .select('id, photo_url, thumb_url')
      .eq('event_id', RHEA_EVENT_ID)
      .eq('source', 'luke')
      .eq('status', 'live')
      .not('sub_event_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(MAX_SLIDES)
      .then(({ data }) => {
        if (!alive) return;
        setSlides((data || []).map((p, i) => ({
          src: p.photo_url || p.thumb_url,
          alt: `Rhea County Raider Competition photo ${i + 1}`,
        })));
      });
    return () => { alive = false; };
  }, []);

  const count = slides?.length || 0;
  const goTo = useCallback((i) => {
    if (count === 0) return;
    setIndex(((i % count) + count) % count);
  }, [count]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (paused || count < 2) return undefined;
    timerRef.current = setTimeout(next, AUTOPLAY_MS);
    return () => clearTimeout(timerRef.current);
  }, [index, paused, next, count]);

  // Keep index valid if the slide set changes size.
  useEffect(() => {
    if (count > 0 && index >= count) setIndex(0);
  }, [count, index]);

  const loading = slides === null;
  const empty = !loading && count === 0;

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
        aria-label="Rhea County Raider Competition photo carousel"
        style={{
          position: 'relative', width: '100%', aspectRatio: '21 / 9',
          minHeight: 260,
          border: `1px solid ${P.hair}`, background: P.navy, overflow: 'hidden',
        }}
      >
        {loading && <Placeholder label="LOADING PHOTOS…" />}
        {empty && <Placeholder label="PHOTOS COMING SOON" />}

        {!loading && !empty && (
          <>
            <div key={index} className="rc-slide" style={{ position: 'absolute', inset: 0 }}>
              <Slide slide={slides[index]} />
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
              {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
            </div>

            {count > 1 && (
              <>
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
              </>
            )}
          </>
        )}
      </div>

      {/* dots */}
      {!loading && !empty && count > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {slides.map((_, i) => (
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
      )}
    </div>
  );
}
