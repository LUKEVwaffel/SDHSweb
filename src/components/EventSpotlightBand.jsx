import { useState, useEffect } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.6)', faint: 'rgba(244,236,216,0.4)',
  hairline: 'rgba(201,169,97,0.25)',
};

const CAROUSEL_INTERVAL_MS = 4500;
const FADE_MS = 500;

// Postgres `date` columns come back as a bare "YYYY-MM-DD" string — parsing
// that directly with `new Date()` reads it as UTC midnight, which rolls
// back a day in any negative-UTC timezone. Building the Date from parts
// keeps it local and avoids that off-by-one.
function formatEventDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function PhotoCarousel({ photos }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (photos.length <= 1) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % photos.length), CAROUSEL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [photos.length]);

  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: '4/3',
      border: `1px solid ${P.hairline}`, overflow: 'hidden', background: P.deep,
    }}>
      {photos.map((photo, i) => (
        <img
          key={photo.path}
          src={photo.url} alt=""
          width={800} height={600}
          loading={i === 0 ? 'eager' : 'lazy'}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            opacity: i === index ? 1 : 0, transition: `opacity ${FADE_MS}ms ease`,
          }}
        />
      ))}
      {photos.length > 1 && (
        <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
          {photos.map((photo, i) => (
            <div key={photo.path} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: i === index ? P.gold : 'rgba(244,236,216,0.35)',
              transition: 'background 200ms ease',
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

// Homepage beta test — one-off, not-on-the-calendar event write-up + up to
// 10 photos. Renders nothing unless an admin has turned it on in
// DISPATCH → Beta Features (supabase/beta_event_spotlight.sql, singleton
// row). Same source of truth as the Range TV slide (SlideEventSpotlight.jsx)
// so the two never drift out of sync.
export default function EventSpotlightBand() {
  const [row, setRow] = useState(null);

  useEffect(() => {
    SB.from('beta_event_spotlight').select('*').eq('active', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setRow(data || null));
  }, []);

  if (!row || (!row.title && !row.description && !(row.photos || []).length)) return null;

  const photos = row.photos || [];

  return (
    <section className="spotlight-section" style={{
      background: `linear-gradient(160deg, ${P.navy} 0%, ${P.deep} 60%, ${P.ink} 100%)`,
      padding: '72px 32px', borderBottom: `1px solid ${P.hairline}`,
      position: 'relative', overflow: 'hidden',
    }}>
      <div className="spotlight-grid" style={{
        maxWidth: 1200, margin: '0 auto', position: 'relative',
        display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,0.9fr)',
        gap: 56, alignItems: 'center',
      }}>
        <div>
          <div style={{
            color: P.gold, opacity: 0.75, fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10, letterSpacing: '0.32em', marginBottom: 14,
          }}>// SPECIAL RECOGNITION</div>

          {row.title && (
            <h2 style={{
              color: P.cream, fontFamily: 'Oswald, sans-serif', fontWeight: 700,
              fontSize: 'clamp(28px, 4.4vw, 44px)', letterSpacing: '0.02em',
              lineHeight: 1.05, margin: '0 0 10px',
            }}>{row.title}</h2>
          )}

          {row.event_date && (
            <div style={{
              color: P.faint, fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              letterSpacing: '0.14em', textTransform: 'uppercase', margin: '0 0 18px',
            }}>{formatEventDate(row.event_date)}</div>
          )}

          {row.description && (
            <p style={{
              color: P.mute, fontFamily: 'Inter, sans-serif', fontSize: 16,
              lineHeight: 1.7, margin: '0 0 12px',
            }}>{row.description}</p>
          )}

          {row.people && (
            <p style={{
              color: P.gold, fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
              letterSpacing: '0.08em', margin: 0,
            }}>{row.people}</p>
          )}
        </div>

        {photos.length > 0 && <PhotoCarousel photos={photos} />}
      </div>

      <style>{`
        @media (max-width: 760px) { .spotlight-grid { grid-template-columns: 1fr !important; gap: 36px !important; } }
        @media (max-width: 767px) { .spotlight-section { padding: 32px 20px !important; } }
      `}</style>
    </section>
  );
}
