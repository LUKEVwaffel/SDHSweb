const P = {
  ink: '#06101F', gold: '#C9A961', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.6)', hair: 'rgba(201,169,97,0.22)',
};
const mono = "'JetBrains Mono', monospace";

// Shared full-screen photo viewer — was duplicated near-identically across
// Pictures.jsx and TeamGallery.jsx before the /events rework added a third
// consumer, so it's pulled out here.
export default function PhotoLightbox({ photo, onClose, fallbackLabel = 'BATTALION PHOTO' }) {
  if (!photo) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(6,16,31,0.95)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '92vw', maxHeight: '92vh' }}>
        <img src={photo.photo_url} alt="" style={{ maxWidth: '100%', maxHeight: '86vh', objectFit: 'contain', display: 'block' }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(6,16,31,0.85)', padding: '10px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontFamily: mono, fontSize: 10, color: P.gold }}>
            {photo.uploader_name ? `📷 ${photo.uploader_name}` : fallbackLabel}
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: `1px solid ${P.hair}`, color: P.mute,
            fontFamily: mono, fontSize: 10, padding: '6px 14px', cursor: 'pointer',
          }}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}
