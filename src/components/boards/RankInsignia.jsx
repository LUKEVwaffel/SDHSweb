import { rankInfo } from '../../lib/boardRules';

// Hand-drawn Army rank insignia as inline SVG, so promotions read visually
// (PFC → CPL is "one rocker becomes two chevrons", not just letters).
// Enlisted: chevrons point up, rockers curve underneath. Officers: bars,
// oak leaves, eagle — gold or silver per Army regs.

const GOLD = '#D6B25E';
const SILVER = '#C9CED6';

function chevron(i, color) {
  const y = 9 + i * 7.5;
  return <path key={`c${i}`} d={`M5 ${y + 9} L20 ${y} L35 ${y + 9}`} fill="none" stroke={color} strokeWidth="5.4" strokeLinejoin="miter" strokeLinecap="butt" />;
}

function rocker(i, base, color) {
  const y = base + i * 7.5;
  return <path key={`r${i}`} d={`M5 ${y} Q20 ${y + 9} 35 ${y}`} fill="none" stroke={color} strokeWidth="5.4" strokeLinecap="butt" />;
}

function Enlisted({ chevrons, rockers, center }) {
  const base = 9 + (chevrons - 1) * 7.5 + 12;
  // Vertically center the stack in the 50-unit box.
  const bottom = rockers ? base + (rockers - 1) * 7.5 + 9 : 9 + (chevrons - 1) * 7.5 + 9;
  const shift = (50 - (bottom - 9 + 6)) / 2 - 6;
  return (
    <g transform={`translate(0 ${shift})`}>
      {Array.from({ length: chevrons }, (_, i) => chevron(i, GOLD))}
      {Array.from({ length: rockers }, (_, i) => rocker(i, base, GOLD))}
      {center === 'diamond' && <path d={`M20 ${base - 1} l4 5 -4 5 -4 -5z`} fill={GOLD} />}
      {center === 'star' && <path d={`M20 ${base - 2} l1.8 3.7 4 .6 -2.9 2.8 .7 4 -3.6 -1.9 -3.6 1.9 .7 -4 -2.9 -2.8 4 -.6z`} fill={GOLD} />}
      {center === 'wreath' && (
        <>
          <circle cx="20" cy={base + 4} r="6.2" fill="none" stroke={GOLD} strokeWidth="1.6" />
          <path d={`M20 ${base} l1.4 2.9 3.1 .4 -2.3 2.2 .6 3.1 -2.8 -1.5 -2.8 1.5 .6 -3.1 -2.3 -2.2 3.1 -.4z`} fill={GOLD} />
        </>
      )}
    </g>
  );
}

const Bar = ({ x, color }) => <rect x={x} y="12" width="6" height="26" rx="1.2" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />;

const Leaf = ({ color }) => (
  <path
    d="M20 6 C29 12 32 22 27 32 C25 36 22 38 20 42 C18 38 15 36 13 32 C8 22 11 12 20 6 Z M20 12 L20 40"
    fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="0.8"
  />
);

const Eagle = () => (
  <path
    d="M20 10 l3 4 9 -5 -3 9 6 2 -9 4 2 8 -5 -3 -3 9 -3 -9 -5 3 2 -8 -9 -4 6 -2 -3 -9 9 5z"
    fill={SILVER} stroke="rgba(0,0,0,0.3)" strokeWidth="0.7"
  />
);

const SHAPES = {
  PV2: <Enlisted chevrons={1} rockers={0} />,
  PFC: <Enlisted chevrons={1} rockers={1} />,
  CPL: <Enlisted chevrons={2} rockers={0} />,
  SGT: <Enlisted chevrons={3} rockers={0} />,
  SSG: <Enlisted chevrons={3} rockers={1} />,
  SFC: <Enlisted chevrons={3} rockers={2} />,
  MSG: <Enlisted chevrons={3} rockers={3} />,
  '1SG': <Enlisted chevrons={3} rockers={3} center="diamond" />,
  SGM: <Enlisted chevrons={3} rockers={3} center="star" />,
  CSM: <Enlisted chevrons={3} rockers={3} center="wreath" />,
  '2LT': <Bar x={17} color={GOLD} />,
  '1LT': <Bar x={17} color={SILVER} />,
  CPT: <><Bar x={12} color={SILVER} /><Bar x={22} color={SILVER} /></>,
  MAJ: <Leaf color={GOLD} />,
  LTC: <Leaf color={SILVER} />,
  COL: <Eagle />,
};

/**
 * @param {{ rank: string | null | undefined, size?: number, title?: boolean }} props
 */
export default function RankInsignia({ rank, size = 36, title = true }) {
  const info = rankInfo(rank);
  const label = info ? `${info.code} — ${info.name}` : 'Rank not recorded';
  const shape = SHAPES[rank];
  return (
    <svg
      className={`tb-insignia${shape ? '' : ' tb-insignia--blank'}`}
      width={size} height={size * 1.25} viewBox="0 0 40 50" role="img" aria-label={label}
    >
      {title && <title>{label}</title>}
      {shape ?? (
        info
          ? <text x="20" y="31" textAnchor="middle" fontSize="9" fill="currentColor" fontFamily="JetBrains Mono, monospace">{info.code}</text>
          : <text x="20" y="31" textAnchor="middle" fontSize="14" fill="currentColor" fontFamily="JetBrains Mono, monospace">?</text>
      )}
    </svg>
  );
}
