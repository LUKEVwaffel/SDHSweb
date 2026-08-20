import { useState, useEffect } from 'react';
import { supabase as SB } from '../../lib/supabaseClient';
import { P, mono, oswald, fraunces, inter, fs, sp } from '../admin/theme.js';

// One-off full-screen welcome for the Raider parent meeting, reached at
// /raiderparent (see App.jsx bypass — same pattern as /tv and /tv/range).
// QR codes are generated client-side from these destination URLs (same
// `qrcode` lib + dynamic-import pattern as TvRangeRaiderPracticeWidget.jsx)
// rather than uploaded as images — no Supabase storage round-trip needed.
const GROUPME_URL = 'https://web.groupme.com/join_group/88754734/Jol6vWyH';
const WEBSITE_URL = 'https://www.sdhsjrotc.com/raiders';

// Commanders shown are the top 3 by sort_order from the same personnel query
// Raiders.jsx uses for its "Meet Your Commanders" row — one source of
// photos/names, no separate data entry for this one-off screen.
const COMMANDER_COUNT = 3;

function useQrDataUrl(value) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (!value) { setSrc(null); return; }
    let cancelled = false;
    import('qrcode')
      .then(({ toDataURL }) =>
        toDataURL(value, { margin: 1, width: 480, color: { dark: '#06101F', light: '#F4ECD8' } })
      )
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) setSrc(null); });
    return () => { cancelled = true; };
  }, [value]);
  return src;
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function initials(name) {
  return (name || '').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function QrCard({ src, alt, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[2], width: 'min(30vh, 26vw)', maxWidth: 340 }}>
      <div style={{
        width: '100%', aspectRatio: '1 / 1', background: P.cream, borderRadius: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        boxShadow: `0 18px 44px rgba(0,0,0,0.45), 0 0 0 1px ${P.hairStrong}`,
      }}>
        {src ? (
          <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        ) : (
          <span style={{ fontFamily: mono, fontSize: fs.sm, color: P.deep, textAlign: 'center', padding: sp[4], letterSpacing: '0.04em' }}>
            Generating…
          </span>
        )}
      </div>
      <div style={{ fontFamily: mono, fontSize: fs.sm, letterSpacing: '0.1em', color: P.gold, textTransform: 'uppercase', textAlign: 'center' }}>
        {label}
      </div>
    </div>
  );
}

function CommanderCard({ person }) {
  const [imgOk, setImgOk] = useState(true);
  const hasPhoto = person.photo_url && imgOk;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[2] }}>
      <div style={{
        width: '100%', aspectRatio: '3 / 4', borderRadius: 10, overflow: 'hidden', position: 'relative',
        border: `1px solid ${P.hair}`, background: `linear-gradient(160deg, rgba(20,40,71,0.9), rgba(6,16,31,0.95))`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
      }}>
        {hasPhoto ? (
          <img
            src={person.photo_url} alt={person.name} onError={() => setImgOk(false)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }}
          />
        ) : (
          <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 40, color: P.gold, opacity: 0.35 }}>
            {initials(person.name)}
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(6,16,31,0.85))' }} />
      </div>
      <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: fs.lg, color: P.cream, textAlign: 'center' }}>
        {person.name}
      </div>
      <div style={{ fontFamily: mono, fontSize: fs.tiny, letterSpacing: '0.16em', color: P.gold, opacity: 0.7, textAlign: 'center' }}>
        {(person.role_long || person.role_short || 'RAIDER COMMANDER').toUpperCase()}
      </div>
    </div>
  );
}

export default function RaiderParentWelcome() {
  const groupmeQr = useQrDataUrl(GROUPME_URL);
  const websiteQr = useQrDataUrl(WEBSITE_URL);
  const now = useClock();
  const [commanders, setCommanders] = useState([]);

  useEffect(() => {
    SB.from('personnel').select('*').eq('section', 'raider').eq('visible', true).order('sort_order').limit(COMMANDER_COUNT)
      .then(({ data }) => setCommanders(data || []));
  }, []);

  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink, fontFamily: inter,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 60% 55% at 22% 20%, ${P.goldWash} 0%, transparent 60%),
                     radial-gradient(ellipse 50% 45% at 85% 85%, rgba(201,169,97,0.06) 0%, transparent 65%)`,
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.45,
        backgroundImage: `linear-gradient(${P.hair} 1px, transparent 1px), linear-gradient(90deg, ${P.hair} 1px, transparent 1px)`,
        backgroundSize: '64px 64px',
        maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 0%, transparent 78%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 0%, transparent 78%)',
      }} />

      {/* header: eyebrow + title on the left, live clock top-right */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '4vh 5vw 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[3] }}>
          <div style={{
            fontFamily: mono, fontSize: fs.md, letterSpacing: '0.22em', color: P.gold, textTransform: 'uppercase',
            padding: `${sp[2]}px ${sp[5]}px`, border: `1px solid ${P.hairStrong}`, borderRadius: 999,
            background: `linear-gradient(160deg, ${P.goldWash}, transparent)`, alignSelf: 'flex-start',
          }}>
            Raider Team &middot; Parent Meeting
          </div>
          <h1 style={{
            fontFamily: fraunces, fontWeight: 800, fontStyle: 'italic', color: P.cream, margin: 0,
            fontSize: 'clamp(64px, 11vh, 170px)', lineHeight: 0.95,
            textShadow: '0 4px 40px rgba(201,169,97,0.18)',
          }}>
            Welcome
          </h1>
        </div>

        <div style={{
          fontFamily: mono, fontSize: 'clamp(20px, 3.4vh, 40px)', color: P.cream, letterSpacing: '0.04em',
          padding: `${sp[2]}px ${sp[5]}px`, border: `1px solid ${P.hair}`, borderRadius: 10, background: P.deep,
          flexShrink: 0,
        }}>
          {timeStr}
        </div>
      </div>

      {/* body: commanders left, QR codes right */}
      <div style={{ position: 'relative', flex: 1, display: 'flex', minHeight: 0, padding: '3vh 5vw 5vh', gap: '4vw' }}>
        <div style={{ flex: 1.15, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: sp[6], minWidth: 0 }}>
          <div style={{ fontFamily: mono, fontSize: fs.sm, letterSpacing: '0.2em', color: P.mute, textTransform: 'uppercase' }}>
            Meet Your Commanders
          </div>
          <div style={{ display: 'flex', gap: sp[6] }}>
            {commanders.map((c) => <CommanderCard key={c.id} person={c} />)}
          </div>
        </div>

        <div style={{
          flex: 1.15, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '2vh', borderLeft: `1px solid ${P.hair}`, paddingLeft: '3vw',
        }}>
          <QrCard src={groupmeQr} alt="QR code to join the parent GroupMe" label="Join Parent GroupMe" />
          <QrCard src={websiteQr} alt="QR code for sdhsjrotc.com/raiders" label="sdhsjrotc.com/raiders" />
        </div>
      </div>
    </div>
  );
}
