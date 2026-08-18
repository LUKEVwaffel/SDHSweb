import { useState, useEffect } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.6)', faint: 'rgba(244,236,216,0.4)',
  hairline: 'rgba(201,169,97,0.25)',
};

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
      <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
        <div style={{
          color: P.gold, opacity: 0.75, fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10, letterSpacing: '0.32em', marginBottom: 14,
        }}>// SPECIAL RECOGNITION</div>

        {row.title && (
          <h2 style={{
            color: P.cream, fontFamily: 'Oswald, sans-serif', fontWeight: 700,
            fontSize: 'clamp(28px, 4.4vw, 44px)', letterSpacing: '0.02em',
            lineHeight: 1.05, margin: '0 0 18px',
          }}>{row.title}</h2>
        )}

        {row.description && (
          <p style={{
            color: P.mute, fontFamily: 'Inter, sans-serif', fontSize: 16,
            lineHeight: 1.7, maxWidth: 760, margin: '0 0 12px',
          }}>{row.description}</p>
        )}

        {row.people && (
          <p style={{
            color: P.gold, fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
            letterSpacing: '0.08em', margin: '0 0 32px',
          }}>{row.people}</p>
        )}

        {photos.length > 0 && (
          <div className="spotlight-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12,
          }}>
            {photos.map((photo, i) => (
              <a key={photo.path} href={photo.url} target="_blank" rel="noopener noreferrer">
                <img
                  src={photo.url} alt="" width={400} height={300}
                  loading={i < 2 ? 'eager' : 'lazy'}
                  style={{
                    width: '100%', aspectRatio: '4/3', objectFit: 'cover',
                    border: `1px solid ${P.hairline}`, display: 'block',
                  }}
                />
              </a>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 767px) { .spotlight-section { padding: 32px 20px !important; } }
      `}</style>
    </section>
  );
}
