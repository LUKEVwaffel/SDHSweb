import { useState, useEffect } from 'react';
import { P, mono, fraunces, inter, fs, sp } from '../admin/theme.js';

// One-off full-screen welcome for the Raider parent meeting, reached at
// /raiderparent (see App.jsx bypass — same pattern as /tv and /tv/range).
// QR codes are generated client-side from these destination URLs (same
// `qrcode` lib + dynamic-import pattern as TvRangeRaiderPracticeWidget.jsx)
// rather than uploaded as images — no Supabase storage round-trip needed.
const GROUPME_URL = 'https://web.groupme.com/join_group/88754734/Jol6vWyH';
const WEBSITE_URL = 'https://www.sdhsjrotc.com/raiders';

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

function QrCard({ src, alt, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[3], width: 'min(30vh, 26vw)', maxWidth: 340 }}>
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
      <div style={{ fontFamily: mono, fontSize: fs.md, letterSpacing: '0.1em', color: P.gold, textTransform: 'uppercase', textAlign: 'center' }}>
        {label}
      </div>
    </div>
  );
}

export default function RaiderParentWelcome() {
  const groupmeQr = useQrDataUrl(GROUPME_URL);
  const websiteQr = useQrDataUrl(WEBSITE_URL);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink, fontFamily: inter,
      display: 'flex', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 60% 55% at 22% 30%, ${P.goldWash} 0%, transparent 60%),
                     radial-gradient(ellipse 50% 45% at 85% 80%, rgba(201,169,97,0.06) 0%, transparent 65%)`,
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.45,
        backgroundImage: `linear-gradient(${P.hair} 1px, transparent 1px), linear-gradient(90deg, ${P.hair} 1px, transparent 1px)`,
        backgroundSize: '64px 64px',
        maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 0%, transparent 78%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 0%, transparent 78%)',
      }} />

      <div style={{
        position: 'relative', flex: 1.15, display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 5vw', gap: sp[6],
      }}>
        <div style={{
          fontFamily: mono, fontSize: fs.md, letterSpacing: '0.22em', color: P.gold, textTransform: 'uppercase',
          padding: `${sp[2]}px ${sp[5]}px`, border: `1px solid ${P.hairStrong}`, borderRadius: 999,
          background: `linear-gradient(160deg, ${P.goldWash}, transparent)`,
        }}>
          Raider Team &middot; Parent Meeting
        </div>
        <h1 style={{
          fontFamily: fraunces, fontWeight: 800, fontStyle: 'italic', color: P.cream, margin: 0,
          fontSize: 'clamp(56px, 11vh, 148px)', lineHeight: 1.0,
          textShadow: '0 4px 40px rgba(201,169,97,0.18)',
        }}>
          Welcome
        </h1>
        <div style={{ fontFamily: inter, fontSize: fs.lg, color: P.mute, lineHeight: 1.4, maxWidth: '34ch' }}>
          Thanks for joining us tonight. Scan a code on the right to join the parent GroupMe or visit the Raider program page.
        </div>
      </div>

      <div style={{
        position: 'relative', flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '4vh', padding: '6vh 4vw',
        borderLeft: `1px solid ${P.hair}`,
        background: 'linear-gradient(180deg, rgba(20,40,71,0.35), rgba(20,40,71,0.1))',
      }}>
        <QrCard src={groupmeQr} alt="QR code to join the parent GroupMe" label="Join Parent GroupMe" />
        <QrCard src={websiteQr} alt="QR code for sdhsjrotc.com/raiders" label="sdhsjrotc.com/raiders" />
      </div>
    </div>
  );
}
