import { useState } from 'react';

const P = {
  navyDeep: '#0A1628', gold: '#C9A961', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.6)', hairline: 'rgba(201,169,97,0.25)',
};

// Verification text for the "top 5% nationally" ranking claim.
const VERIFY_TEXT =
  "Soddy-Daisy JROTC earned 'Honor Unit with Distinction,' the U.S. Army's top designation, awarded to roughly the top 5% of JROTC programs nationally, for 35 consecutive years as of 2019 (Chattanooga Times Free Press).";

const SOURCE = 'SOURCE // CHATTANOOGA TIMES FREE PRESS · 2019';

/**
 * Hover/focus popover verifying the "top 5% nationally" ranking claim.
 * Wrap any claim element as children. Sharp-edged, matches the military system.
 *
 * @param {{ children: React.ReactNode, text?: string, style?: object }} props
 */
export default function VerifiedTooltip({ children, text = VERIFY_TEXT, style }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', cursor: 'help', ...style }}
      tabIndex={0}
      aria-label={text}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}

      {/* verified marker — small gold corner tick */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', top: -6, right: -6,
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
          color: P.gold, lineHeight: 1, pointerEvents: 'none',
          opacity: 0.85,
        }}
      >
        ✓
      </span>

      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute', bottom: 'calc(100% + 12px)', left: '50%',
            transform: 'translateX(-50%)',
            width: 300, zIndex: 200,
            background: P.navyDeep, border: `1px solid ${P.hairline}`,
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            padding: '14px 16px', textAlign: 'left',
            cursor: 'default',
          }}
        >
          <span
            style={{
              display: 'block',
              fontFamily: 'Inter, sans-serif', fontSize: 12, lineHeight: 1.6,
              color: P.cream,
            }}
          >
            {text}
          </span>
          <span
            style={{
              display: 'block', marginTop: 10,
              fontFamily: "'JetBrains Mono', monospace", fontSize: 8,
              letterSpacing: '0.16em', color: P.gold, opacity: 0.75,
            }}
          >
            {SOURCE}
          </span>
          {/* caret */}
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', top: '100%', left: '50%',
              transform: 'translateX(-50%)',
              width: 10, height: 10,
              background: P.navyDeep,
              borderRight: `1px solid ${P.hairline}`,
              borderBottom: `1px solid ${P.hairline}`,
              marginTop: -5,
              rotate: '45deg',
            }}
          />
        </span>
      )}
    </span>
  );
}
