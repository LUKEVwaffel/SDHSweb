import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCompGallery } from '../../hooks/useCompGallery';
import { COMP_EVENT_TITLE } from '../../lib/raiderCompGallery';

// Public "View Competition" gallery - /raiders/comp. Retrospective, per-event
// cut of the Rhea County comp: Luke's photos only, grouped by the 6 events.
// URL ?event=<slug> deep-links a single event (shareable, back button works).
// Palette mirrors Raiders.jsx so it reads as the same specialty-team surface.

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)',
  hairStrong: 'rgba(201,169,97,0.5)', green: '#7EC87E',
};
const mono = "'JetBrains Mono', monospace";
const oswald = 'Oswald, sans-serif';

// Copy for the not-yet-posted slots. Photos have a Wednesday target; run
// footage is looser - Luke's slammed and it drops later.
const PHOTO_SOON = "Still being edited. Luke's a bit backed up. Up by Wednesday.";
const VIDEO_SOON = "Run footage for this event comes out later. Luke's very busy right now.";

function Brackets({ size = 14, opacity = 0.4 }) {
  const s = `1px solid rgba(201,169,97,${opacity})`;
  return (
    <>
      {[
        { top: 0, left: 0, borderTop: s, borderLeft: s },
        { top: 0, right: 0, borderTop: s, borderRight: s },
        { bottom: 0, left: 0, borderBottom: s, borderLeft: s },
        { bottom: 0, right: 0, borderBottom: s, borderRight: s },
      ].map((st, i) => (
        <div key={i} style={{ position: 'absolute', width: size, height: size, ...st, pointerEvents: 'none' }} />
      ))}
    </>
  );
}

// ── Lightbox ────────────────────────────────────────────────────────────────
function Lightbox({ photos, index, onClose, onIndex }) {
  const has = index != null && index >= 0 && index < photos.length;

  const step = useCallback((d) => {
    onIndex((cur) => {
      const next = cur + d;
      if (next < 0 || next >= photos.length) return cur;
      return next;
    });
  }, [photos.length, onIndex]);

  useEffect(() => {
    if (!has) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [has, step, onClose]);

  if (!has) return null;
  const photo = photos[index];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(6,16,31,0.94)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        backdropFilter: 'blur(6px)',
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'absolute', top: 16, right: 20, background: 'none', border: `1px solid ${P.hair}`,
          color: P.cream, fontFamily: mono, fontSize: 14, cursor: 'pointer', padding: '6px 12px',
        }}
      >
        ✕ ESC
      </button>

      {index > 0 && (
        <button onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous" style={navArrow('left')}>‹</button>
      )}
      {index < photos.length - 1 && (
        <button onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next" style={navArrow('right')}>›</button>
      )}

      <figure onClick={(e) => e.stopPropagation()} style={{ margin: 0, maxWidth: '100%', maxHeight: '100%', textAlign: 'center' }}>
        <img
          src={photo.photo_url || photo.thumb_url}
          alt=""
          style={{ maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain', border: `1px solid ${P.hair}` }}
        />
        <figcaption style={{ marginTop: 10, fontFamily: mono, fontSize: 9, letterSpacing: '0.16em', color: P.mute }}>
          {index + 1} / {photos.length}{photo.uploader_name ? ` · ${photo.uploader_name}` : ''}
        </figcaption>
      </figure>
    </div>
  );
}

function navArrow(side) {
  return {
    position: 'absolute', [side]: 12, top: '50%', transform: 'translateY(-50%)',
    background: 'rgba(6,16,31,0.7)', border: `1px solid ${P.hair}`, color: P.gold,
    fontFamily: oswald, fontSize: 32, lineHeight: 1, cursor: 'pointer', padding: '10px 18px',
  };
}

// ── Photo grid ──────────────────────────────────────────────────────────────
function PhotoGrid({ photos, onOpen }) {
  if (!photos.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
      {photos.map((p, i) => (
        <button
          key={p.id}
          onClick={() => onOpen(i)}
          style={{
            border: `1px solid ${P.hair}`, background: P.navy, padding: 0, cursor: 'pointer',
            aspectRatio: '1 / 1', overflow: 'hidden', position: 'relative',
          }}
        >
          <img
            src={p.thumb_url || p.photo_url}
            alt=""
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </button>
      ))}
    </div>
  );
}

// ── "coming soon" panel (shared by empty photo + video slots) ───────────────
function ComingSoon({ kind, note }) {
  return (
    <div style={{
      border: `1px dashed ${P.hairStrong}`, background: 'rgba(201,169,97,0.03)',
      padding: '30px 24px', display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <span aria-hidden="true" style={{ fontSize: 22, color: P.gold, opacity: 0.6 }}>
        {kind === 'video' ? '▶' : '◱'}
      </span>
      <div>
        <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 16, color: P.cream, letterSpacing: '0.05em' }}>
          {kind === 'video' ? 'RUN FOOTAGE COMING' : 'PHOTOS COMING'}
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: P.mute, marginTop: 4 }}>
          {note}
        </div>
      </div>
    </div>
  );
}

// ── Standing notice - top of every view ────────────────────────────────────
function TopNotice() {
  return (
    <div style={{
      border: `1px solid ${P.hairStrong}`, background: 'rgba(201,169,97,0.05)',
      padding: '14px 18px', marginBottom: 28, display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <span aria-hidden="true" style={{ fontSize: 14, color: P.gold, lineHeight: 1.5 }}>ⓘ</span>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: P.cream, lineHeight: 1.65 }}>
        This is Luke&apos;s set for now. Parent-submitted photos will be added later, once he&apos;s caught up.
        There&apos;s a large batch of Obstacle Course shots. Run footage for some events also drops later; Luke&apos;s very busy right now.
      </div>
    </div>
  );
}

// ── Event card (index view) ─────────────────────────────────────────────────
function EventCard({ group, onOpen }) {
  const [hover, setHover] = useState(false);
  const { hasContent } = group;
  return (
    <button
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: `1px solid ${hover ? P.hairStrong : P.hair}`, background: P.deep, cursor: 'pointer',
        padding: 0, textAlign: 'left', position: 'relative', overflow: 'hidden',
        transition: 'border-color 0.2s', opacity: hasContent ? 1 : 0.82,
      }}
    >
      <Brackets size={16} opacity={hover ? 0.7 : 0.3} />
      <div style={{ aspectRatio: '4 / 3', background: P.navy, position: 'relative', overflow: 'hidden' }}>
        {hasContent ? (
          <img
            src={group.cover}
            alt=""
            loading="lazy"
            style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              transform: hover ? 'scale(1.04)' : 'scale(1)', transition: 'transform 0.4s',
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 6,
            alignItems: 'center', justifyContent: 'center',
            background: `repeating-linear-gradient(135deg, ${P.deep} 0 10px, ${P.navy} 10px 11px)`,
          }}>
            <span style={{ fontSize: 20, color: P.gold, opacity: 0.5 }}>◱</span>
            <span style={{ fontFamily: mono, fontSize: 8, color: `${P.gold}99`, letterSpacing: '0.22em' }}>
              COMING SOON
            </span>
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 55%, rgba(6,16,31,0.9))' }} />
      </div>
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 20, color: P.cream, letterSpacing: '0.03em' }}>
          {group.name}
        </div>
        <div style={{ fontFamily: mono, fontSize: 8.5, color: P.gold, letterSpacing: '0.18em', opacity: 0.75, marginTop: 6 }}>
          {hasContent
            ? `${group.photos.length} PHOTO${group.photos.length === 1 ? '' : 'S'}`
            : (group.hasVideo ? 'PHOTOS + VIDEO SOON' : 'PHOTOS SOON')}
        </div>
      </div>
    </button>
  );
}

// ── Event detail view ──────────────────────────────────────────────────────
function EventDetail({ group, onBack }) {
  const [lb, setLb] = useState(null);
  return (
    <div>
      <button onClick={onBack} style={backBtn}>← ALL EVENTS</button>
      <h2 style={{ fontFamily: oswald, fontWeight: 700, fontSize: 44, color: P.cream, letterSpacing: '0.03em', margin: '14px 0 6px' }}>
        {group.name}
      </h2>
      {group.blurb && (
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute, margin: '0 0 28px', maxWidth: 560 }}>
          {group.blurb}
        </p>
      )}

      <div style={{ marginBottom: group.hasVideo ? 34 : 0 }}>
        <SectionRule label={group.hasContent ? `// PHOTOS · ${group.photos.length}` : '// PHOTOS'} />
        {group.hasContent
          ? <PhotoGrid photos={group.photos} onOpen={setLb} />
          : <ComingSoon kind="photos" note={PHOTO_SOON} />}
      </div>

      {/* Run footage - only for the events that actually have clips coming
          (Gauntlet, CCR, OC, One Rope, Highland). No player yet; the slot is
          here so families know where it'll land. */}
      {group.hasVideo && (
        <>
          <SectionRule label="// RUN FOOTAGE" />
          <ComingSoon kind="video" note={VIDEO_SOON} />
        </>
      )}

      <Lightbox photos={group.photos} index={lb} onClose={() => setLb(null)} onIndex={setLb} />
    </div>
  );
}

function SectionRule({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 16px' }}>
      <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.28em', opacity: 0.7 }}>{label}</div>
      <div style={{ flex: 1, height: 1, background: P.hair }} />
    </div>
  );
}

const backBtn = {
  background: 'transparent', border: 'none', cursor: 'pointer', color: P.gold,
  fontFamily: mono, fontSize: 10, letterSpacing: '0.22em', padding: '4px 0',
};

// ── Page ───────────────────────────────────────────────────────────────────
export default function CompGallery() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { groups, totals, loading, error } = useCompGallery();

  const activeSlug = params.get('event');
  const active = groups.find((g) => g.slug === activeSlug) || null;

  useEffect(() => { window.scrollTo(0, 0); }, [activeSlug]);

  const openEvent = (slug) => setParams(slug ? { event: slug } : {});

  return (
    <div style={{ background: P.ink, minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 40px 100px' }}>

        <button onClick={() => navigate('/raiders')} style={{ ...backBtn, letterSpacing: '0.28em', marginBottom: 22 }}>
          ← RAIDERS
        </button>

        {!loading && !error && <TopNotice />}

        {!active && !loading && (
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.38em', opacity: 0.75, marginBottom: 10 }}>
              VIEW COMPETITION
            </div>
            <h1 style={{ fontFamily: oswald, fontWeight: 700, fontSize: 60, color: P.cream, letterSpacing: '0.02em', margin: 0, lineHeight: 1 }}>
              {COMP_EVENT_TITLE.toUpperCase()}
            </h1>
            <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.2em', color: P.gold, opacity: 0.6, marginTop: 16 }}>
              {totals.withPhotos} OF {totals.events} EVENTS POSTED · {totals.photos} PHOTO{totals.photos === 1 ? '' : 'S'}
            </div>
          </div>
        )}

        {loading && (
          <div style={{ fontFamily: mono, fontSize: 10, color: P.mute, letterSpacing: '0.2em' }}>LOADING…</div>
        )}

        {error && !loading && (
          <div style={{ border: `1px solid ${P.hairStrong}`, background: P.deep, padding: '20px 24px', fontFamily: mono, fontSize: 10, color: P.bright }}>
            COULD NOT LOAD GALLERY: {error}
          </div>
        )}

        {!loading && !error && active && (
          <EventDetail group={active} onBack={() => openEvent(null)} />
        )}

        {!loading && !error && !active && groups.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {groups.map((g) => (
              <EventCard key={g.slug} group={g} onOpen={() => openEvent(g.slug)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
