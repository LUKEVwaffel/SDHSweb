import { useNavigate } from 'react-router-dom';
import { useRaftingPhotos } from '../hooks/useRaftingPhotos';
import { RAFTING_TITLE } from '../lib/rafting';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.6)', hair: 'rgba(201,169,97,0.25)',
};

// Homepage band pointing at /rafting. Renders nothing until at least one
// photo is uploaded in DISPATCH -> Rafting Trip, so the home page stays
// clean until the set exists. Shows a strip of the first few shots + a
// count, click anywhere to open the full gallery.
const PREVIEW_COUNT = 5;

export default function RaftingPhotoBand() {
  const navigate = useNavigate();
  const { photos, loading } = useRaftingPhotos();

  if (loading || !photos.length) return null;

  const preview = photos.slice(0, PREVIEW_COUNT);

  return (
    <section
      onClick={() => navigate('/rafting')}
      className="rafting-band"
      style={{
        cursor: 'pointer', position: 'relative', overflow: 'hidden',
        borderBottom: `1px solid ${P.hair}`, background: P.deep,
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)',
      }}
    >
      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.24em', color: P.gold }}>
          // BATTALION PHOTOS
        </span>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 'clamp(24px, 3.4vw, 40px)', color: P.cream, letterSpacing: '0.03em', lineHeight: 1 }}>
          {RAFTING_TITLE}
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute }}>
          {photos.length} photo{photos.length === 1 ? '' : 's'} from the trip
        </div>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.16em', color: P.gold, borderBottom: `1px solid ${P.gold}`, paddingBottom: 2, alignSelf: 'flex-start', marginTop: 6 }}>
          VIEW ALL PHOTOS →
        </span>
      </div>
      <div style={{ display: 'flex', minHeight: 200, background: P.navy }}>
        {preview.map((p) => (
          <div key={p.id} style={{ flex: 1, minWidth: 0, borderLeft: `1px solid ${P.ink}` }}>
            <img
              src={p.url} alt={p.caption || ''} loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        ))}
      </div>
      <style>{`
        @media (max-width: 720px) { .rafting-band { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}
