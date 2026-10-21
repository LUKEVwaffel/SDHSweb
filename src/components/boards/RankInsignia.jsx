import { useId } from 'react';
import { rankInfo } from '../../lib/boardRules';

// Army JROTC cadet rank insignia, drawn as the black shoulder mark cadets
// actually wear with gold pin-on devices (Cadet Command insignia — NOT
// active-Army officer insignia):
//   Enlisted — chevrons point up, rockers curve underneath; 1SG diamond,
//              SGM star, CSM star in a wreath between them. PVT wears none.
//   Officers — company grade wears discs (2LT 1 · 1LT 2 · CPT 3),
//              field grade wears diamonds (MAJ 1 · LTC 2 · COL 3).

const MARK = '#121418';
const EDGE = '#6f5a2a';
const CX = 20;
// Usable insignia area on the mark (viewBox 0 0 40 50).
const AREA_TOP = 14;
const AREA_BOTTOM = 47;

// Army chevron geometry: broad chevrons with a visible gap between each,
// rockers that join the lowest chevron's tips and sag into an arc, leaving
// a hollow where the 1SG diamond / SGM star / CSM wreath sits.
const LEFT = 8.5;
const RIGHT = 31.5;
const STROKE = 2.5;
const CHEVRON_RISE = 7;
const STEP = 3.9;
const ROCKER_DIP = 7; // visible sag at the centre of a rocker

function enlistedHeight(chevrons, rockers) {
  const chev = CHEVRON_RISE + (chevrons - 1) * STEP;
  const rock = rockers ? ROCKER_DIP + (rockers - 1) * STEP : 0;
  return chev + rock + STROKE;
}

function Star({ cx, cy, r, fill }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
  });
  return <polygon points={pts.join(' ')} fill={fill} />;
}

function Enlisted({ chevrons, rockers = 0, device, gold }) {
  const top = AREA_TOP + (AREA_BOTTOM - AREA_TOP - enlistedHeight(chevrons, rockers)) / 2 + STROKE / 2;
  const tips = top + CHEVRON_RISE + (chevrons - 1) * STEP; // y of the lowest chevron's tips
  // Centre of the hollow between the lowest chevron and the first rocker.
  const hollow = tips + (ROCKER_DIP - CHEVRON_RISE) / 2 + 0.6;
  return (
    <g fill="none" stroke={gold} strokeWidth={STROKE} strokeLinejoin="miter" strokeMiterlimit="10">
      {Array.from({ length: chevrons }, (_, i) => {
        const y = top + i * STEP;
        return <path key={`c${i}`} d={`M${LEFT} ${y + CHEVRON_RISE} L${CX} ${y} L${RIGHT} ${y + CHEVRON_RISE}`} />;
      })}
      {Array.from({ length: rockers }, (_, i) => {
        const y = tips + i * STEP;
        return <path key={`r${i}`} d={`M${LEFT} ${y} Q${CX} ${y + ROCKER_DIP * 2} ${RIGHT} ${y}`} />;
      })}
      {device === 'diamond' && (
        <path d={`M${CX} ${hollow - 3.6} l2.9 3.6 -2.9 3.6 -2.9 -3.6z`} fill={gold} stroke="none" />
      )}
      {device === 'star' && <Star cx={CX} cy={hollow + 0.3} r={3.7} fill={gold} />}
      {device === 'wreath' && (
        <g stroke="none">
          <Star cx={CX} cy={hollow - 0.2} r={2.4} fill={gold} />
          <path
            d={`M${CX - 4.2} ${hollow - 2.6} Q${CX - 5} ${hollow + 3} ${CX} ${hollow + 3.3} Q${CX + 5} ${hollow + 3} ${CX + 4.2} ${hollow - 2.6}`}
            fill="none" stroke={gold} strokeWidth="1.1"
          />
        </g>
      )}
    </g>
  );
}

function stackYs(count, pitch) {
  const mid = (AREA_TOP + AREA_BOTTOM) / 2;
  return Array.from({ length: count }, (_, i) => mid + (i - (count - 1) / 2) * pitch);
}

function Discs({ count, gold, shine }) {
  return stackYs(count, 9.6).map((y) => (
    <g key={y}>
      <circle cx={CX} cy={y} r="4.1" fill={gold} />
      <circle cx={CX} cy={y} r="2.6" fill="none" stroke={shine} strokeWidth="0.6" opacity="0.55" />
    </g>
  ));
}

function Diamonds({ count, gold, shine }) {
  return stackYs(count, 10.2).map((y) => (
    <g key={y}>
      <path d={`M${CX} ${y - 5} L${CX + 4} ${y} L${CX} ${y + 5} L${CX - 4} ${y} Z`} fill={gold} />
      <path d={`M${CX} ${y - 2.6} L${CX + 2} ${y} L${CX} ${y + 2.6} L${CX - 2} ${y} Z`} fill="none" stroke={shine} strokeWidth="0.55" opacity="0.55" />
    </g>
  ));
}

const DEVICES = {
  PVT: () => null,
  PV2: (p) => <Enlisted chevrons={1} {...p} />,
  PFC: (p) => <Enlisted chevrons={1} rockers={1} {...p} />,
  CPL: (p) => <Enlisted chevrons={2} {...p} />,
  SGT: (p) => <Enlisted chevrons={3} {...p} />,
  SSG: (p) => <Enlisted chevrons={3} rockers={1} {...p} />,
  SFC: (p) => <Enlisted chevrons={3} rockers={2} {...p} />,
  MSG: (p) => <Enlisted chevrons={3} rockers={3} {...p} />,
  '1SG': (p) => <Enlisted chevrons={3} rockers={3} device="diamond" {...p} />,
  SGM: (p) => <Enlisted chevrons={3} rockers={3} device="star" {...p} />,
  CSM: (p) => <Enlisted chevrons={3} rockers={3} device="wreath" {...p} />,
  '2LT': (p) => <Discs count={1} {...p} />,
  '1LT': (p) => <Discs count={2} {...p} />,
  CPT: (p) => <Discs count={3} {...p} />,
  MAJ: (p) => <Diamonds count={1} {...p} />,
  LTC: (p) => <Diamonds count={2} {...p} />,
  COL: (p) => <Diamonds count={3} {...p} />,
};

const MARK_PATH = 'M8 48.5 Q6.5 48.5 6.5 47 L6.5 10.5 L20 3 L33.5 10.5 L33.5 47 Q33.5 48.5 32 48.5 Z';

/**
 * @param {{ rank: string | null | undefined, size?: number, title?: boolean }} props
 */
export default function RankInsignia({ rank, size = 36, title = true }) {
  const gradId = `tbgold${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const info = rankInfo(rank);
  const Device = info ? DEVICES[info.code] : null;
  const label = info ? `Cadet ${info.name} (${info.code})` : 'Rank not recorded';
  const gold = `url(#${gradId})`;
  const shine = '#fff3c4';

  return (
    <svg
      className={`tb-insignia${info ? '' : ' tb-insignia--blank'}`}
      width={size} height={size * 1.25} viewBox="0 0 40 50" role="img" aria-label={label}
    >
      {title && <title>{label}</title>}
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#f6dd8c" />
          <stop offset="0.55" stopColor="#d4ac52" />
          <stop offset="1" stopColor="#a87b25" />
        </linearGradient>
      </defs>
      {info ? (
        <>
          <path d={MARK_PATH} fill={MARK} stroke={EDGE} strokeWidth="0.9" />
          <circle cx={CX} cy="9.6" r="1.7" fill={gold} />
          <Device gold={gold} shine={shine} />
        </>
      ) : (
        <>
          <path d={MARK_PATH} fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2.4 2" />
          <text x={CX} y="33" textAnchor="middle" fontSize="13" fill="currentColor" fontFamily="JetBrains Mono, monospace">?</text>
        </>
      )}
    </svg>
  );
}
