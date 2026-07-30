import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase as SB } from '../lib/supabaseClient';
import { fetchRecentPhotos } from '../lib/photoQueries';
import { EVENT_CATEGORIES, DEFAULT_POC, categoryColor, teamLabel, formatEventTime } from '../lib/calendar';
import MonthGridCalendar from './calendar/MonthGridCalendar';
import PhotoLightbox from './PhotoLightbox';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)', hairStrong: 'rgba(201,169,97,0.5)',
};
const mono = "'JetBrains Mono', monospace";
const oswald = 'Oswald, sans-serif';
const inter = 'Inter, sans-serif';

// Public /events page: day-grid calendar + always-visible recent-photos grid.
// No event-first click required — the grid defaults to recent photos across
// every team, and picking a calendar day/event just narrows it.
export default function EventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    SB.from('events').select('*').eq('status', 'posted').order('date', { ascending: true })
      .then(({ data }) => { setEvents(data || []); setLoadingEvents(false); });
  }, []);

  const loadPhotos = useCallback((eventId) => {
    setLoadingPhotos(true);
    fetchRecentPhotos({ eventId })
      .then(setPhotos)
      .catch(() => setPhotos([]))
      .finally(() => setLoadingPhotos(false));
  }, []);

  useEffect(() => { loadPhotos(selectedEventId); }, [selectedEventId, loadPhotos]);

  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;

  return (
    <section style={{ background: P.ink, minHeight: '100vh', fontFamily: inter }}>
      <style>{`
        .events-layout { display: grid; grid-template-columns: 380px 1fr; gap: 40px; align-items: start; }
        @media (max-width: 900px) { .events-layout { grid-template-columns: 1fr; } }
        @media (max-width: 767px) {
          .events-header { padding: 24px 20px 28px !important; }
          .events-title { font-size: 42px !important; }
          .events-body { padding: 24px 20px 60px !important; }
        }
      `}</style>

      {/* Header */}
      <div className="events-header" style={{ borderBottom: `1px solid ${P.hair}`, padding: '60px 40px 40px', maxWidth: 1400, margin: '0 auto' }}>
        <button onClick={() => navigate('/')} style={backBtn}>← BACK</button>
        <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.32em', marginBottom: 12 }}>
          // BATTALION CALENDAR &amp; OPTIC PHOTOS
        </div>
        <h1 className="events-title" style={{ fontFamily: oswald, fontWeight: 700, fontSize: 72, color: P.cream, letterSpacing: '0.02em', margin: 0, lineHeight: 0.9 }}>
          EVENTS
        </h1>
        <p style={{ color: P.mute, fontSize: 15, lineHeight: 1.7, marginTop: 20, maxWidth: 620, margin: '20px 0 0' }}>
          Full battalion schedule and recent photos from every team. Pick a day to see photos from that event, or browse everything below.
        </p>
      </div>

      <div className="events-body" style={{ maxWidth: 1400, margin: '0 auto', padding: '36px 40px 90px' }}>
        <div className="events-layout">
          {/* Calendar column */}
          <div>
            {loadingEvents ? (
              <div style={loadingStyle}>LOADING CALENDAR…</div>
            ) : (
              <>
                <MonthGridCalendar events={events} selectedEventId={selectedEventId} onSelectEvent={setSelectedEventId} />
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20, paddingTop: 16, borderTop: `1px solid ${P.hair}` }}>
                  {EVENT_CATEGORIES.filter((c) => c.id !== 'EVENT').map((c) => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 7, height: 7, background: c.color }} />
                      <span style={{ fontFamily: mono, fontSize: 8, letterSpacing: '0.12em', color: P.mute }}>{c.id.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Photo grid column */}
          <div>
            {selectedEvent && <EventDetailCard event={selectedEvent} />}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, letterSpacing: '0.2em' }}>
                {selectedEvent ? `PHOTOS · ${selectedEvent.title.toUpperCase()}` : 'OPTIC · RECENT PHOTOS · ALL TEAMS'}
              </div>
              <button onClick={() => navigate('/submit')} style={ghostBtn}>+ SUBMIT A PHOTO</button>
            </div>

            {loadingPhotos ? (
              <div style={loadingStyle}>LOADING PHOTOS…</div>
            ) : photos.length === 0 ? (
              <div style={{ ...loadingStyle, padding: 48 }}>
                {selectedEvent ? 'NO PHOTOS FOR THIS EVENT YET' : 'NO PHOTOS YET — BE THE FIRST TO ADD ONE'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {photos.map((photo) => (
                  <div key={photo.id} style={{ position: 'relative', cursor: 'pointer', overflow: 'hidden', background: P.deep }}
                    onClick={() => setLightbox(photo)}>
                    <img src={photo.thumb_url || photo.photo_url} alt={photo.uploader_name || ''} loading="lazy"
                      style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', transition: 'transform 0.2s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    />
                    {photo.uploader_name && (
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'linear-gradient(to top, rgba(6,16,31,0.92) 0%, transparent 100%)',
                        padding: '20px 10px 8px',
                      }}>
                        <span style={{ fontFamily: mono, fontSize: 9, color: P.gold }}>📷 {photo.uploader_name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <PhotoLightbox photo={lightbox} onClose={() => setLightbox(null)} />
    </section>
  );
}

function formatDateRange(date, end_date) {
  const opts = { month: 'short', day: 'numeric', year: 'numeric' };
  const start = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', opts);
  if (!end_date) return start;
  const end = new Date(`${end_date}T00:00:00`).toLocaleDateString('en-US', opts);
  return `${start} – ${end}`;
}

// Full event detail — date(s), time, calendar, category, location, and the
// fields that must actually reach parents: uniform, transportation, and a
// downloadable/printable permission slip PDF. Rendered on the public /events
// page when a calendar day/event is selected.
function EventDetailCard({ event }) {
  const time = formatEventTime(event.event_time);
  return (
    <div style={{ border: `1px solid ${P.hairStrong}`, background: P.navy, padding: 22, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, background: categoryColor(event.category), flexShrink: 0 }} />
        <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.18em', color: P.gold }}>{(event.category || 'EVENT').replace('_', ' ')}</span>
      </div>
      <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 24, color: P.cream, marginBottom: 12 }}>{event.title}</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: event.uniform_required || event.transportation_required || event.permission_slip_required ? 16 : 0 }}>
        <DetailField label="Date">{formatDateRange(event.date, event.end_date)}</DetailField>
        {time && <DetailField label="Time">{time}</DetailField>}
        <DetailField label="Calendar">{teamLabel(event.team)}</DetailField>
        {event.location && <DetailField label="Location">{event.location}</DetailField>}
        <DetailField label="POC">
          {(!event.poc || event.poc === DEFAULT_POC.name)
            ? <a href={`mailto:${DEFAULT_POC.email}`} style={{ color: P.cream, textDecoration: 'none', borderBottom: `1px solid ${P.hairStrong}` }}>{DEFAULT_POC.name}</a>
            : event.poc}
        </DetailField>
      </div>

      {(event.uniform_required || event.transportation_required || event.permission_slip_required) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, paddingTop: 16, borderTop: `1px solid ${P.hair}` }}>
          {event.uniform_required && <DetailField label="Uniform">{event.uniform}</DetailField>}
          {event.transportation_required && <DetailField label="Transportation">{event.transportation}</DetailField>}
          {event.permission_slip_required && event.permission_slip_url && (
            <div>
              <div style={{ fontFamily: mono, fontSize: 8, letterSpacing: '0.14em', color: P.mute, marginBottom: 6 }}>PERMISSION SLIP</div>
              <a href={event.permission_slip_url} target="_blank" rel="noopener noreferrer" download style={{ ...ghostBtn, textDecoration: 'none', display: 'inline-block' }}>
                ↓ DOWNLOAD PDF
              </a>
            </div>
          )}
        </div>
      )}

      {event.description && (
        <div style={{ fontFamily: inter, fontSize: 13, color: P.mute, lineHeight: 1.6, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${P.hair}` }}>
          {event.description}
        </div>
      )}
    </div>
  );
}

function DetailField({ label, children }) {
  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 8, letterSpacing: '0.14em', color: P.mute, marginBottom: 4 }}>{label.toUpperCase()}</div>
      <div style={{ fontFamily: inter, fontSize: 13, color: P.cream }}>{children}</div>
    </div>
  );
}

const backBtn = { background: 'none', border: 'none', color: P.gold, cursor: 'pointer', fontFamily: mono, fontSize: 10, letterSpacing: '0.28em', padding: 0, marginBottom: 20, display: 'block' };
const ghostBtn = { background: 'transparent', border: `1px solid ${P.hairStrong}`, color: P.gold, fontFamily: mono, fontSize: 10, letterSpacing: '0.16em', padding: '9px 18px', cursor: 'pointer', whiteSpace: 'nowrap' };
const loadingStyle = { textAlign: 'center', padding: 60, fontFamily: mono, fontSize: 10, color: P.mute, letterSpacing: '0.2em' };
