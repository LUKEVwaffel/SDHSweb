import { P, mono, oswald, sp } from '../admin/theme.js';

const TEXT_SIZE = {
  normal: 'clamp(1.75rem, 1.1rem + 2.4vw, 3.25rem)',
  large:  'clamp(2.75rem, 1.4rem + 4.4vw, 5.5rem)',
  huge:   'clamp(3.75rem, 1.6rem + 6.6vw, 8rem)',
};

/**
 * Fills the carousel column, not the whole screen — revised from the
 * original full-takeover recommendation. Weather and the Time/Bell widget
 * (TvClockBellPanel) stay visible in the right column exactly as normal
 * (TvKiosk.jsx just keeps rendering them, unconditionally mounted, so
 * Weather keeps polling at its normal interval instead of freezing); only
 * the photo carousel and the bottom quote/facts widget get replaced. Any
 * admin can fire this (no PIN gate — see EmergencyPushPanel), so "MESSAGE
 * FROM STAFF" is a fixed label, not attributed to a specific person.
 */
export default function TvEmergencyOverlay({ text, header, photoUrl, textSize = 'normal' }) {
  const fontSize = TEXT_SIZE[textSize] || TEXT_SIZE.normal;

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', background: P.ink,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {photoUrl && (
        <>
          <img
            src={photoUrl} alt="" aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(6,16,31,0.94) 0%, rgba(6,16,31,0.62) 45%, rgba(6,16,31,0.35) 100%)',
          }} />
        </>
      )}

      <div style={{
        position: 'relative', zIndex: 1, flex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: `${sp[8]}px ${sp[6]}px`, gap: sp[3],
      }}>
        <div style={{
          fontFamily: mono, fontSize: 'clamp(0.7rem, 0.6rem + 0.4vw, 0.95rem)', color: P.mute,
          letterSpacing: '0.28em',
        }}>
          MESSAGE FROM STAFF
        </div>

        {header && (
          <div style={{
            fontFamily: mono, fontSize: 'clamp(0.9rem, 0.7rem + 0.8vw, 1.4rem)', color: P.gold,
            letterSpacing: '0.16em', textTransform: 'uppercase',
          }}>
            {header}
          </div>
        )}
        <div style={{
          fontFamily: oswald, fontWeight: 600, fontSize, color: P.cream,
          lineHeight: 1.1, maxWidth: '92%', textShadow: photoUrl ? '0 4px 24px rgba(0,0,0,0.7)' : 'none',
        }}>
          {text}
        </div>
      </div>
    </div>
  );
}
