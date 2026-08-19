import { useState, useEffect } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { P, mono, inter, fs, sp } from '../../../admin/theme.js';
import TvRangeScreenBase from '../TvRangeScreenBase.jsx';

const PHOTO_ROTATE_MS = 4000;

// See EventSpotlightBand.jsx's identical helper for why this doesn't just
// call `new Date(dateStr)` — a bare "YYYY-MM-DD" parses as UTC midnight and
// rolls back a day in negative-UTC timezones.
function formatEventDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// Full-screen slide for the one-off "beta test" event spotlight. Reads the
// same singleton row BetaFeaturesPanel.jsx writes and EventSpotlightBand.jsx
// reads on the homepage — no per-slide config (SLIDE_TYPES.eventSpotlight's
// defaultConfig is `{}`), so the write-up only ever needs to be entered once.
// Internally cycles through the photo set on its own timer, independent of
// this slide's overall durationSec in the rotation.
export default function SlideEventSpotlight() {
  const [row, setRow] = useState(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    SB.from('beta_event_spotlight').select('*').eq('active', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setRow(data || null));
  }, []);

  const photos = row?.photos || [];

  useEffect(() => {
    if (photos.length <= 1) return undefined;
    const id = setInterval(() => setPhotoIndex((i) => (i + 1) % photos.length), PHOTO_ROTATE_MS);
    return () => clearInterval(id);
  }, [photos.length]);

  if (row === null) return null; // still loading — avoid a flash of the empty state
  if (!row.active || (!row.title && !row.description && !photos.length)) {
    return (
      <TvRangeScreenBase kicker="SPOTLIGHT" title="Nothing set." sub="Turn on an event in DISPATCH → Beta Features." />
    );
  }

  const photo = photos[photoIndex];

  return (
    <div style={{ position: 'fixed', inset: 0, background: P.ink, fontFamily: inter, display: 'flex' }}>
      {photo && (
        <div style={{ flex: photos.length ? 1.3 : 0, position: 'relative', minWidth: 0 }}>
          <img
            key={photo.path}
            src={photo.url} alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      )}
      <div style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: sp[16], gap: sp[6], boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: sp[3] }}>
          <div style={{ width: 28, height: 2, background: P.gold }} />
          <span style={{ fontFamily: mono, fontSize: fs.md, color: P.gold, letterSpacing: '0.32em' }}>SPOTLIGHT</span>
        </div>
        {row.title && (
          <div style={{ fontFamily: inter, fontWeight: 800, color: P.cream, fontSize: 'clamp(28px, 4.6vh, 56px)', lineHeight: 1.1 }}>
            {row.title}
          </div>
        )}
        {row.event_date && (
          <div style={{ fontFamily: mono, fontSize: fs.sm, color: P.faint, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            {formatEventDate(row.event_date)}
          </div>
        )}
        {row.description && (
          <div style={{ fontFamily: inter, fontSize: 'clamp(16px, 2.2vh, 24px)', color: P.mute, lineHeight: 1.5 }}>
            {row.description}
          </div>
        )}
        {row.people && (
          <div style={{ fontFamily: mono, fontSize: fs.md, color: P.gold, letterSpacing: '0.06em' }}>
            {row.people}
          </div>
        )}
      </div>
    </div>
  );
}
