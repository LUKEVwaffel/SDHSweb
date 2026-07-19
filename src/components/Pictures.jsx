import { useState, useEffect } from 'react';
import { supabase as SB } from '../lib/supabaseClient';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)',
  green: '#27AE60', red: '#C0392B',
};

// Public event photo archive. Reads the unified `photos` table (event_id set),
// grouped by event. Display-only: competitive voting lives in the Raiders poll,
// the single photo/voting system. (Old event_photos + photo_votes retired.)
export default function Pictures({ setActive }) {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [photosByEvent, setPhotosByEvent] = useState({});
  const [lightbox, setLightbox] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: photos }, { data: evs }] = await Promise.all([
        SB.from('photos').select('*').not('event_id', 'is', null).order('created_at', { ascending: false }),
        SB.from('events').select('*').order('date', { ascending: false }),
      ]);
      const grouped = {};
      (photos || []).forEach((ph) => { (grouped[ph.event_id] ||= []).push(ph); });
      const withPhotos = (evs || [])
        .map((ev) => ({ ...ev, photo_count: grouped[ev.id]?.length || 0 }))
        .filter((ev) => ev.photo_count > 0);
      setPhotosByEvent(grouped);
      setEvents(withPhotos);
      if (withPhotos.length > 0) setSelectedEvent(withPhotos[0]);
      setLoading(false);
    }
    load();
  }, []);

  const photos = selectedEvent ? (photosByEvent[selectedEvent.id] || []) : [];

  return (
    <section style={{ background: P.ink, minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${P.hair}`, padding: '60px 40px 40px', maxWidth: 1400, margin: '0 auto' }}>
        <button onClick={() => setActive('home')} style={{
          background: 'none', border: 'none', color: P.gold, cursor: 'pointer',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
          letterSpacing: '0.28em', padding: 0, marginBottom: 20, display: 'block',
        }}>← BACK</button>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.gold, letterSpacing: '0.32em', marginBottom: 12 }}>
          // PHOTO ARCHIVE
        </div>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 72, color: P.cream, letterSpacing: '0.02em', margin: 0, lineHeight: 0.9 }}>
          PICTURES
        </h1>
        <p style={{ color: P.mute, fontSize: 15, lineHeight: 1.7, marginTop: 20, maxWidth: 560, margin: '20px 0 0' }}>
          Photos from battalion events. Click any photo to expand.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.mute, letterSpacing: '0.2em' }}>LOADING…</div>
      ) : (
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 40px 80px' }}>

          {/* Event Selector */}
          <div style={{ display: 'flex', gap: 8, padding: '28px 0 0', flexWrap: 'wrap' }}>
            {events.map(ev => (
              <button key={ev.id} onClick={() => setSelectedEvent(ev)}
                style={{
                  background: selectedEvent?.id === ev.id ? P.gold : 'transparent',
                  border: `1px solid ${selectedEvent?.id === ev.id ? P.gold : P.hair}`,
                  color: selectedEvent?.id === ev.id ? P.ink : P.cream,
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                  letterSpacing: '0.15em', padding: '8px 16px', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}>
                {ev.title.toUpperCase()} · {ev.photo_count} PHOTOS
              </button>
            ))}
            {!events.length && (
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.mute }}>NO EVENTS WITH PHOTOS YET</div>
            )}
          </div>

          {selectedEvent && photos.length > 0 && (
            <div style={{ paddingTop: 28 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.mute, letterSpacing: '0.2em', marginBottom: 16 }}>
                {photos.length} PHOTOS · CLICK TO EXPAND
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                {photos.map(photo => (
                  <div key={photo.id} style={{ position: 'relative', cursor: 'pointer', overflow: 'hidden', background: P.deep }}
                    onClick={() => setLightbox(photo)}>
                    <img src={photo.thumb_url || photo.photo_url} alt={photo.uploader_name || ''} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', transition: 'transform 0.2s' }}
                      onMouseEnter={e => e.target.style.transform = 'scale(1.04)'}
                      onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                    />
                    {photo.uploader_name && (
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'linear-gradient(to top, rgba(6,16,31,0.92) 0%, transparent 100%)',
                        padding: '20px 10px 8px',
                      }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold }}>📷 {photo.uploader_name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(6,16,31,0.95)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 20,
          }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img src={lightbox.photo_url} alt="" style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', display: 'block' }} />
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'rgba(6,16,31,0.85)', padding: '10px 16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.gold }}>
                {lightbox.uploader_name ? `📷 ${lightbox.uploader_name}` : 'BATTALION PHOTO'}
              </span>
              <button onClick={() => setLightbox(null)} style={{
                background: 'none', border: `1px solid ${P.hair}`, color: P.mute,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                padding: '6px 14px', cursor: 'pointer',
              }}>CLOSE</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
