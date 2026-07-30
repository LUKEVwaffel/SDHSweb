import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase as SB } from '../lib/supabaseClient';

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)',
};

// Keyboard activation for click-through cards.
function activate(e, fn) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fn();
  }
}

// ─── Scoped motion + focus styles ────────────────────────────────────────────
function HeroStyles() {
  return (
    <style>{`
      @keyframes cmdRise { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes reticlePulse { 0%,100% { opacity: 0.35; } 50% { opacity: 0.7; } }
      @keyframes bgBlink { 0%,100% { opacity: 0.55; } 50% { opacity: 0.14; } }
      @keyframes bgDrift { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
      @keyframes bgSpin  { to { transform: rotate(360deg); } }
      @keyframes bgDraw  { to { stroke-dashoffset: 0; } }
      .cmd-enter { animation: cmdRise 0.75s cubic-bezier(0.16,1,0.3,1) both; }
      .reticle-core { animation: reticlePulse 3.2s ease-in-out infinite; }
      .bg-blink { animation: bgBlink 2.6s ease-in-out infinite; }
      .bg-drift { animation: bgDrift 13s ease-in-out infinite; }
      .bg-spin  { transform-box: fill-box; transform-origin: center; animation: bgSpin 48s linear infinite; }
      .bg-draw  { stroke-dasharray: 200; stroke-dashoffset: 200; animation: bgDraw 6s ease-in-out infinite alternate; }
      .cmd-clickable:focus-visible { outline: 2px solid #C9A961; outline-offset: 4px; }
      @media (prefers-reduced-motion: reduce) {
        .cmd-enter { animation: none; opacity: 1; transform: none; }
        .reticle-core, .bg-blink, .bg-drift, .bg-spin, .bg-draw { animation: none; }
        .bg-draw { stroke-dashoffset: 0; }
      }
    `}</style>
  );
}

// ─── Planning-board background ("used whiteboard") ───────────────────────────
// Chalk = cream marker, gold = amber marker. Everything low-opacity behind the
// trio so the cards stay legible. Elements cluster at the edges.
const CHALK = 'rgba(244,236,216,';
const FLAG_RED = '#9E5B5B';
const FLAG_BLUE = '#5B6E9E';

// Scattered equations / annotations, spread to clear the corner motifs and the
// centered trio. `mark`: circle | underline (marker emphasis).
const BOARD_MATH = [
  // Left mid-band (top-left flag / bottom-left map / mid-left guidon kept clear)
  { t: 'α = arctan(h/d)',   top: '30%', left: '1.6%', c: 'gold' },
  { t: 'μ = Σxᵢ / n',       top: '37%', left: '5.5%', c: 'chalk' },
  { t: 'σ² = Σ(x−μ)²/n',    top: '60%', left: '1.5%', c: 'gold', mark: 'underline' },
  { t: 'n = 3 echelon',     top: '67%', left: '5%',   c: 'chalk', mark: 'circle' },
  // Right mid-band (top-right compass / bottom-right symbols kept clear)
  { t: 'TN-051 // GRID 16S', top: '30%', right: '1.3%', c: 'chalk' },
  { t: 'AZ = 137°',         top: '39%', right: '5.5%', c: 'gold', mark: 'circle' },
  { t: 'R = v²sin2θ / g',   top: '49%', right: '1.1%', c: 'gold' },
  { t: 'MSL 210 m',         top: '58%', right: '5.5%', c: 'chalk' },
  { t: 'Δ = excellence',    top: '67%', right: '1.8%', c: 'gold', mark: 'underline' },
  // Bottom gutter, under the trio
  { t: 'cos θ = adj/hyp',   bottom: '13%', left: '29%', c: 'chalk' },
  { t: 'Σ cadets = 27',     bottom: '5%',  left: '41%', c: 'chalk', mark: 'circle' },
  { t: 'F = m·a',           bottom: '6%',  left: '56%', c: 'gold' },
  { t: 'bearing 045°',      bottom: '13%', right: '29%', c: 'gold' },
];

function boardColor(c, a) { return c === 'chalk' ? `${CHALK}${a})` : `rgba(201,169,97,${a})`; }

function MathScatter() {
  return (
    <>
      {BOARD_MATH.map((m, i) => {
        const stroke = boardColor(m.c, 0.16);
        const base = {
          position: 'absolute', top: m.top, bottom: m.bottom, left: m.left, right: m.right,
          fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
          color: stroke, letterSpacing: '0.1em', whiteSpace: 'nowrap',
        };
        if (m.mark === 'circle') {
          return (
            <div key={i} style={{ ...base, padding: '4px 10px', border: `1px solid ${boardColor(m.c, 0.18)}`, borderRadius: '46%' }}>
              {m.t}
            </div>
          );
        }
        if (m.mark === 'underline') {
          return <div key={i} style={{ ...base, borderBottom: `1px solid ${boardColor(m.c, 0.22)}`, paddingBottom: 2 }}>{m.t}</div>;
        }
        return <div key={i} style={base}>{m.t}</div>;
      })}
    </>
  );
}

// Erased-marker smudges — soft cream/gold washes give the "used" board feel.
function Smudges() {
  const blobs = [
    { top: '12%', left: '20%', w: 240, h: 90,  col: `${CHALK}0.05)`, rot: -8 },
    { top: '70%', left: '12%', w: 300, h: 110, col: `rgba(201,169,97,0.045)`, rot: 6 },
    { top: '30%', right: '16%', w: 220, h: 100, col: `${CHALK}0.045)`, rot: 10 },
    { bottom: '10%', right: '24%', w: 260, h: 90, col: `rgba(201,169,97,0.05)`, rot: -5 },
  ];
  return (
    <>
      {blobs.map((b, i) => (
        <div key={i} style={{
          position: 'absolute', top: b.top, bottom: b.bottom, left: b.left, right: b.right,
          width: b.w, height: b.h, transform: `rotate(${b.rot}deg)`,
          background: `radial-gradient(ellipse at center, ${b.col}, transparent 72%)`,
          filter: 'blur(6px)',
        }} />
      ))}
    </>
  );
}

// Edge rulers with periodic ticks — like a map border.
function EdgeRulers() {
  const tickH = `repeating-linear-gradient(90deg, rgba(201,169,97,0.16) 0 1px, transparent 1px 46px)`;
  const tickV = `repeating-linear-gradient(0deg, rgba(201,169,97,0.16) 0 1px, transparent 1px 46px)`;
  return (
    <>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, background: tickH }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 10, background: tickH }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 10, background: tickV }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 10, background: tickV }} />
      {[
        { t: '35.24° N', top: 16, left: 16 },
        { t: '085.18° W', top: 16, right: 16 },
        { t: 'SECTOR 07', bottom: 16, left: 16 },
        { t: 'SHEET 1 / 1', bottom: 16, right: 16 },
      ].map((l, i) => (
        <div key={i} style={{
          position: 'absolute', top: l.top, bottom: l.bottom, left: l.left, right: l.right,
          fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: `${CHALK}0.28)`, letterSpacing: '0.2em',
        }}>{l.t}</div>
      ))}
    </>
  );
}

// Topographic map corner — contour rings, roads, and the SDHS grid pin.
function TacticalMap() {
  return (
    <svg width="230" height="180" viewBox="0 0 230 180" fill="none"
      style={{ position: 'absolute', bottom: '6%', left: '2%', opacity: 0.5 }}>
      {[46, 62, 80, 100].map(r => (
        <ellipse key={r} cx="120" cy="96" rx={r} ry={r * 0.62} stroke={P.gold} strokeOpacity="0.16" strokeWidth="1" />
      ))}
      {/* Roads / rivers */}
      <path d="M 6 40 Q 90 70 120 96 T 224 140" stroke={boardColor('chalk', 0.16)} strokeWidth="1" fill="none" />
      <path d="M 30 170 Q 110 120 150 40" stroke={P.gold} strokeOpacity="0.12" strokeWidth="1" strokeDasharray="3 5" fill="none" />
      {/* Grid overlay */}
      {[40, 120, 200].map(x => <line key={'v'+x} x1={x} y1="10" x2={x} y2="170" stroke={P.gold} strokeOpacity="0.07" strokeWidth="0.5" />)}
      {[40, 96, 152].map(y => <line key={'h'+y} x1="10" y1={y} x2="220" y2={y} stroke={P.gold} strokeOpacity="0.07" strokeWidth="0.5" />)}
      {/* Location pin (diamond) on target */}
      <g className="bg-blink">
        <path d="M 120 84 L 128 96 L 120 108 L 112 96 Z" fill={P.gold} fillOpacity="0.4" stroke={P.gold} strokeOpacity="0.5" strokeWidth="1" />
      </g>
      <circle cx="120" cy="96" r="16" stroke={P.gold} strokeOpacity="0.25" strokeWidth="1" fill="none" />
      <text x="120" y="132" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="8" fill={P.gold} fillOpacity="0.4" letterSpacing="1">SDHS · 35.24N 085.18W</text>
    </svg>
  );
}

// Compass rose, slow drift.
function CompassRose() {
  return (
    <svg width="112" height="112" viewBox="0 0 112 112" fill="none" className="bg-drift"
      style={{ position: 'absolute', top: '9%', right: '3%', opacity: 0.45 }}>
      <circle cx="56" cy="56" r="44" stroke={P.gold} strokeOpacity="0.2" strokeWidth="1" />
      <circle cx="56" cy="56" r="34" stroke={P.gold} strokeOpacity="0.12" strokeWidth="0.5" strokeDasharray="2 4" />
      <g className="bg-spin">
        <path d="M 56 14 L 62 56 L 56 98 L 50 56 Z" fill={P.gold} fillOpacity="0.18" stroke={P.gold} strokeOpacity="0.3" strokeWidth="0.75" />
        <path d="M 14 56 L 56 50 L 98 56 L 56 62 Z" fill="none" stroke={P.gold} strokeOpacity="0.18" strokeWidth="0.75" />
      </g>
      {[['N',56,12],['E',102,59],['S',56,104],['W',10,59]].map(([t,x,y]) => (
        <text key={t} x={x} y={y} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="9" fill={P.gold} fillOpacity="0.4">{t}</text>
      ))}
    </svg>
  );
}

// Mini US flag (canton + stripes).
function USFlag({ style }) {
  const stripes = Array.from({ length: 7 }, (_, i) => i * 4.4);
  return (
    <svg width="70" height="38" viewBox="0 0 70 38" fill="none" style={style}>
      <rect x="0.5" y="0.5" width="69" height="37" stroke={`${CHALK}0.2)`} strokeWidth="1" />
      {stripes.map((y, i) => <rect key={i} x="0" y={y + 0.5} width="70" height="2.4" fill={FLAG_RED} opacity="0.16" />)}
      <rect x="0" y="0" width="30" height="20" fill={FLAG_BLUE} opacity="0.2" />
      {[0,1,2,3].map(r => (
        <g key={r}>
          {[0,1,2,3,4].map(c => (
            <circle key={c} cx={4 + c * 6} cy={4 + r * 4.5} r="0.8" fill={`${CHALK}0.3)`} />
          ))}
        </g>
      ))}
    </svg>
  );
}

// Unit guidon (swallowtail pennant).
function Guidon({ style }) {
  return (
    <svg width="64" height="34" viewBox="0 0 64 34" fill="none" style={style}>
      <path d="M 2 2 L 62 2 L 50 17 L 62 32 L 2 32 Z" stroke={P.gold} strokeOpacity="0.3" strokeWidth="1" fill={`rgba(201,169,97,0.06)`} />
      <line x1="2" y1="2" x2="2" y2="34" stroke={P.gold} strokeOpacity="0.35" strokeWidth="1.5" />
      <text x="26" y="21" textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight="700" fontSize="13" fill={P.gold} fillOpacity="0.32" letterSpacing="1">TB</text>
    </svg>
  );
}

// NATO-style unit symbols.
function UnitSymbols({ style }) {
  return (
    <svg width="150" height="46" viewBox="0 0 150 46" fill="none" style={style}>
      {/* Infantry */}
      <g>
        <rect x="2" y="12" width="34" height="22" stroke={P.gold} strokeOpacity="0.28" strokeWidth="1" />
        <line x1="2" y1="12" x2="36" y2="34" stroke={P.gold} strokeOpacity="0.22" strokeWidth="1" />
        <line x1="36" y1="12" x2="2" y2="34" stroke={P.gold} strokeOpacity="0.22" strokeWidth="1" />
        <text x="19" y="9" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="7" fill={`${CHALK}0.28)`}>HQ</text>
      </g>
      {/* Armor (oval) */}
      <g>
        <rect x="54" y="12" width="34" height="22" stroke={P.gold} strokeOpacity="0.28" strokeWidth="1" />
        <ellipse cx="71" cy="23" rx="12" ry="7" stroke={P.gold} strokeOpacity="0.22" strokeWidth="1" fill="none" />
      </g>
      {/* Recon (single diagonal) */}
      <g>
        <rect x="106" y="12" width="34" height="22" stroke={P.gold} strokeOpacity="0.28" strokeWidth="1" />
        <line x1="106" y1="34" x2="140" y2="12" stroke={P.gold} strokeOpacity="0.22" strokeWidth="1" />
      </g>
    </svg>
  );
}

// Dashed connector lines linking annotations (planning-board wiring).
function Connectors() {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} preserveAspectRatio="none">
      <line x1="0%" y1="105%" x2="50%" y2="0%" stroke={P.gold} strokeWidth="0.7" opacity="0.05" />
      <line x1="100%" y1="105%" x2="50%" y2="0%" stroke={P.gold} strokeWidth="0.7" opacity="0.05" />
      <path className="bg-draw" d="M 60 120 C 200 60, 320 180, 470 100" stroke={P.gold} strokeOpacity="0.18" strokeWidth="1" fill="none" />
    </svg>
  );
}

function SectionBg() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* Base grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(${P.hair} 1px, transparent 1px), linear-gradient(90deg, ${P.hair} 1px, transparent 1px)`,
        backgroundSize: '56px 56px', opacity: 0.2,
      }} />

      <Smudges />
      <EdgeRulers />
      <Connectors />
      <MathScatter />
      <TacticalMap />
      <CompassRose />

      {/* Flags + unit symbols — spread across distinct zones */}
      <USFlag style={{ position: 'absolute', top: '8%', left: '2.5%', opacity: 0.9 }} />
      <Guidon style={{ position: 'absolute', top: '47%', left: '1.8%', opacity: 0.85 }} />
      <UnitSymbols style={{ position: 'absolute', bottom: '9%', right: '2.5%', opacity: 0.9 }} />

      {/* Section corner brackets */}
      {[[{top:12,left:12},{borderTop:`1px solid ${P.gold}25`,borderLeft:`1px solid ${P.gold}25`}],
        [{top:12,right:12},{borderTop:`1px solid ${P.gold}25`,borderRight:`1px solid ${P.gold}25`}],
        [{bottom:12,left:12},{borderBottom:`1px solid ${P.gold}25`,borderLeft:`1px solid ${P.gold}25`}],
        [{bottom:12,right:12},{borderBottom:`1px solid ${P.gold}25`,borderRight:`1px solid ${P.gold}25`}],
      ].map(([pos, border], i) => (
        <div key={i} style={{ position: 'absolute', width: 28, height: 28, ...pos, ...border }} />
      ))}
    </div>
  );
}

// ─── Targeting-reticle grid centered behind the command trio ──────────────────
function CommandReticle() {
  const rings = [96, 168, 240, 300];
  const ticks = Array.from({ length: 24 }, (_, i) => i * 15);
  const bearings = [
    { t: '000', x: 320, y: 24, anchor: 'middle' },
    { t: '090', x: 626, y: 324, anchor: 'end' },
    { t: '180', x: 320, y: 624, anchor: 'middle' },
    { t: '270', x: 22,  y: 324, anchor: 'start' },
  ];
  return (
    <svg
      viewBox="0 0 640 640"
      aria-hidden="true"
      style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 680, height: 680, maxWidth: '92vw',
        transform: 'translate(-50%, -56%)',
        pointerEvents: 'none', zIndex: 0, overflow: 'visible',
      }}
    >
      <defs>
        <radialGradient id="reticleFade" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={P.gold} stopOpacity="0.10" />
          <stop offset="68%"  stopColor={P.gold} stopOpacity="0.035" />
          <stop offset="100%" stopColor={P.gold} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft atmospheric wash */}
      <circle cx="320" cy="320" r="300" fill="url(#reticleFade)" />

      {/* Range rings */}
      {rings.map(r => (
        <circle key={r} cx="320" cy="320" r={r} fill="none" stroke={P.gold} strokeOpacity="0.12" strokeWidth="1" />
      ))}

      {/* Crosshair axes */}
      <line x1="320" y1="6" x2="320" y2="634" stroke={P.gold} strokeOpacity="0.10" strokeWidth="1" strokeDasharray="2 9" />
      <line x1="6" y1="320" x2="634" y2="320" stroke={P.gold} strokeOpacity="0.10" strokeWidth="1" strokeDasharray="2 9" />

      {/* Outer tick marks */}
      {ticks.map(a => {
        const rad = (a * Math.PI) / 180;
        const r1 = 300;
        const r2 = a % 90 === 0 ? 280 : 291;
        return (
          <line
            key={a}
            x1={320 + r1 * Math.cos(rad)} y1={320 + r1 * Math.sin(rad)}
            x2={320 + r2 * Math.cos(rad)} y2={320 + r2 * Math.sin(rad)}
            stroke={P.gold} strokeOpacity="0.2" strokeWidth="1"
          />
        );
      })}

      {/* Bearing labels */}
      {bearings.map(b => (
        <text
          key={b.t} x={b.x} y={b.y} textAnchor={b.anchor}
          fontFamily="'JetBrains Mono', monospace" fontSize="10"
          fill={P.gold} fillOpacity="0.28" letterSpacing="1"
        >{b.t}</text>
      ))}

      {/* Center lock */}
      <circle className="reticle-core" cx="320" cy="320" r="4" fill={P.gold} fillOpacity="0.6" />
      <circle cx="320" cy="320" r="12" fill="none" stroke={P.gold} strokeOpacity="0.25" strokeWidth="1" />
    </svg>
  );
}

// ─── Corner brackets ──────────────────────────────────────────────────────────
function Brackets({ active, size = 14 }) {
  const color = active ? P.gold : `${P.gold}50`;
  const s = `1px solid ${color}`;
  return (
    <>
      {[
        { top: 0, left: 0, borderTop: s, borderLeft: s },
        { top: 0, right: 0, borderTop: s, borderRight: s },
        { bottom: 0, left: 0, borderBottom: s, borderLeft: s },
        { bottom: 0, right: 0, borderBottom: s, borderRight: s },
      ].map((st, i) => (
        <div key={i} style={{ position: 'absolute', width: size, height: size, ...st, pointerEvents: 'none', transition: 'border-color 0.2s' }} />
      ))}
    </>
  );
}

// ─── Schematic placeholder for a missing portrait ─────────────────────────────
function PhotoPending() {
  const r = 20;
  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
      background: `repeating-linear-gradient(135deg, ${P.deep} 0px, ${P.deep} 9px, ${P.navy} 9px, ${P.navy} 10px)`,
    }}>
      <svg width={r * 2} height={r * 2} viewBox="0 0 48 48" fill="none" style={{ opacity: 0.25 }}>
        <circle cx="24" cy="24" r="8" stroke={P.gold} strokeWidth="1" />
        <line x1="24" y1="4"  x2="24" y2="12" stroke={P.gold} strokeWidth="1" />
        <line x1="24" y1="36" x2="24" y2="44" stroke={P.gold} strokeWidth="1" />
        <line x1="4"  y1="24" x2="12" y2="24" stroke={P.gold} strokeWidth="1" />
        <line x1="36" y1="24" x2="44" y2="24" stroke={P.gold} strokeWidth="1" />
      </svg>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: `${P.gold}66`, letterSpacing: '0.24em' }}>
        AWAITING PORTRAIT
      </span>
    </div>
  );
}

// ─── Command portrait card ─────────────────────────────────────────────────
function CommandCard({ person, onViewProfile }) {
  const [hovered, setHovered] = useState(false);
  const view = () => onViewProfile(person);

  return (
    <div
      className="cmd-clickable"
      role="button"
      tabIndex={0}
      aria-label={`View profile: ${person.name}, ${person.role_long || person.role_short}`}
      style={{
        flex: '0 0 200px',
        maxWidth: 200,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        transform: `translateY(${hovered ? -4 : 0}px)`,
        transition: 'transform 0.35s cubic-bezier(0.16,1,0.3,1)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={view}
      onKeyDown={(e) => activate(e, view)}
    >
      {/* Photo frame */}
      <div style={{
        position: 'relative',
        aspectRatio: '3/4',
        overflow: 'hidden',
        border: `1px solid ${hovered ? P.gold : P.hair}`,
        background: P.navy,
        transition: 'border-color 0.25s',
        boxShadow: `0 16px 40px -26px rgba(6,16,31,0.9)`,
      }}>
        {person.photo_url ? (
          <img src={person.photo_url} alt={person.name} style={{
            width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block',
            transition: 'transform 0.4s, filter 0.3s',
            transform: hovered ? 'scale(1.05)' : 'scale(1)',
            filter: hovered ? 'none' : 'saturate(0.82) brightness(0.9)',
          }} />
        ) : (
          <PhotoPending />
        )}
        {/* Gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 42%, rgba(6,16,31,0.88) 100%)',
          pointerEvents: 'none',
        }} />
        <Brackets active={hovered} size={13} />
        {/* Role chip */}
        <div style={{
          position: 'absolute', top: 8, left: 10,
          background: 'rgba(6,16,31,0.75)', border: `1px solid ${P.hair}`,
          padding: '3px 8px', backdropFilter: 'blur(4px)',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.2em',
        }}>{person.role_short}</div>
        {/* Name overlay */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 12px' }}>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 15, color: P.cream, letterSpacing: '0.05em', lineHeight: 1 }}>
            {person.name.toUpperCase()}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: P.mute, marginTop: 4, letterSpacing: '0.1em' }}>
            {person.role_long}
          </div>
        </div>
        {/* Hover overlay */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hovered ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: 'none',
        }}>
          <div style={{
            border: `1px solid ${P.gold}`, background: 'rgba(201,169,97,0.13)',
            backdropFilter: 'blur(4px)', padding: '7px 16px',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.cream, letterSpacing: '0.2em',
          }}>VIEW PROFILE →</div>
        </div>
      </div>
    </div>
  );
}

// ─── Role brief strip — what each position does + why it's competitive ───────
const ROLE_INFO = {
  BC:  { title: 'Battalion Commander', blurb: "Owns the battalion's mission — sets priorities, represents Trojan Battalion to command staff and the school, and is accountable for every cadet's performance." },
  XO:  { title: 'Executive Officer', blurb: "Runs day-to-day operations and keeps every specialty team, staff section, and event synced to the Commander's intent." },
  CSM: { title: 'Command Sergeant Major', blurb: 'Senior enlisted advisor — owns cadet standards, discipline, and welfare, and is the direct link between the Commander and the cadet corps.' },
};

function RoleBriefStrip({ roles }) {
  return (
    <div style={{ marginTop: 36 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${roles.length}, 1fr)`, gap: 0,
        borderTop: `1px solid ${P.hair}`, borderBottom: `1px solid ${P.hair}`,
      }}>
        {roles.map((code, i) => {
          const info = ROLE_INFO[code];
          if (!info) return null;
          return (
            <div key={code} style={{
              padding: '18px 24px',
              borderLeft: i > 0 ? `1px solid ${P.hair}` : 'none',
            }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold,
                letterSpacing: '0.22em', marginBottom: 8,
              }}>{info.title.toUpperCase()}</div>
              <div style={{
                fontFamily: 'Inter, sans-serif', fontSize: 13, lineHeight: 1.55, color: P.mute,
              }}>{info.blurb}</div>
            </div>
          );
        })}
      </div>
      <div style={{
        textAlign: 'center', marginTop: 18,
        fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: P.mute,
        letterSpacing: '0.08em', fontStyle: 'italic', lineHeight: 1.6, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto',
      }}>
        These three positions are filled once a year through a formal application and interview
        process — selected from a battalion-wide pool of cadets competing for the role.
      </div>
    </div>
  );
}

// ─── Main export ────────────────────────────────────────────────────────────────
export default function BattalionCommand() {
  const navigate = useNavigate();
  const [command, setCommand] = useState([]);

  useEffect(() => {
    async function load() {
      const { data } = await SB
        .from('personnel').select('*')
        .eq('visible', true).eq('section', 'command').order('sort_order');
      setCommand(data || []);
    }
    load();
  }, []);

  function goProfile(person) { navigate(`/profile/${person.id}`, { state: { from: 'home' } }); }

  const roleOrder = ['BC', 'XO', 'CSM'];
  const sorted = [...command].sort((a, b) => {
    const ai = roleOrder.indexOf(a.role_short); const bi = roleOrder.indexOf(b.role_short);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const bc  = sorted.find(p => p.role_short === 'BC');
  const xo  = sorted.find(p => p.role_short === 'XO');
  const csm = sorted.find(p => p.role_short === 'CSM');
  const extras = sorted.filter(p => !roleOrder.includes(p.role_short));
  const cmdCount = sorted.length;

  // Podium order: XO left, BC center, CSM right — equal footing now, no featured lift.
  const trio = [
    xo  && { p: xo,  code: 'XO',  delay: '0.08s' },
    bc  && { p: bc,  code: 'BC',  delay: '0.22s' },
    csm && { p: csm, code: 'CSM', delay: '0.36s' },
  ].filter(Boolean);

  // Nothing loaded yet (e.g. offline) — render nothing rather than a stub.
  if (!command.length) return null;

  return (
    <section style={{
      background: P.ink, borderBottom: `1px solid ${P.hair}`,
      padding: '44px 48px 56px', position: 'relative', overflow: 'hidden',
    }}>
      <HeroStyles />
      <SectionBg />

      <div style={{ maxWidth: 1400, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* ── Header — perfectly centered ── */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 10 }}>
            <div style={{ height: 1, width: 40, background: P.hair }} />
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.gold, letterSpacing: '0.3em', opacity: 0.75 }}>
              // AY 2025–26 · TROJAN BATTALION · COMMAND
            </div>
            <div style={{ height: 1, width: 40, background: P.hair }} />
          </div>
          <h2 style={{
            fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 40,
            color: P.cream, letterSpacing: '0.04em', margin: 0, lineHeight: 1,
          }}>THE BATTALION</h2>
          {/* Dot indicator — middle dot marks center, aligns with BC card */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <div style={{ width: 32, height: 1, background: P.hair }} />
            <div style={{ width: 5, height: 5, background: `${P.gold}50` }} />
            <div style={{ width: 7, height: 7, background: P.gold }} />
            <div style={{ width: 5, height: 5, background: `${P.gold}50` }} />
            <div style={{ width: 32, height: 1, background: P.hair }} />
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.mute, letterSpacing: '0.2em', marginTop: 12 }}>
            {cmdCount} PERSONNEL · COMMAND ECHELON
          </div>
        </div>

        {/* ── Podium stage with reticle ── */}
        <div style={{ position: 'relative', padding: '8px 0' }}>
          <CommandReticle />
          <div style={{
            position: 'relative', zIndex: 1,
            display: 'flex', gap: 16, alignItems: 'flex-end', justifyContent: 'center', flexWrap: 'wrap',
          }}>
            {trio.map(({ p, delay }) => (
              <div key={p.id} className="cmd-enter" style={{ animationDelay: delay }}>
                <CommandCard person={p} onViewProfile={goProfile} />
              </div>
            ))}
            {extras.map((p, i) => (
              <div key={p.id} className="cmd-enter" style={{ animationDelay: `${0.45 + i * 0.1}s` }}>
                <CommandCard person={p} onViewProfile={goProfile} />
              </div>
            ))}
          </div>
        </div>

        <RoleBriefStrip roles={trio.map((t) => t.code)} />
      </div>
    </section>
  );
}
