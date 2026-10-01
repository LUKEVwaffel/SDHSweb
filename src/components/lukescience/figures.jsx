// SVG figures for /lukescience. Every "picture" on the page is drawn here so
// nothing depends on a hotlinked image that can disappear.

// Approximate average daily high (deg F) for Chattanooga, from NOAA 1991 to
// 2020 monthly normals, pinned at mid-month (day of year) and linearly
// interpolated between. Close enough to show the shape, labeled "about" on page.
const NORMAL_HIGHS = [
  [135, 80.5], [166, 87.6], [196, 90.4], [227, 89.8],
  [258, 84.4], [288, 74.0], [319, 63.0], [349, 53.0],
];

export function avgHighOn(doy) {
  for (let i = 0; i < NORMAL_HIGHS.length - 1; i += 1) {
    const [d0, t0] = NORMAL_HIGHS[i];
    const [d1, t1] = NORMAL_HIGHS[i + 1];
    if (doy >= d0 && doy <= d1) return t0 + ((t1 - t0) * (doy - d0)) / (d1 - d0);
  }
  return null;
}

const DOY = { may25: 145, jun1: 152, sep1: 244, sep22: 265, sep27: 270, oct1: 274, nov30: 334 };

export function HeroLeaf() {
  return (
    <svg className="ls-hero-leaf" viewBox="0 0 220 260" role="img" aria-label="A maple leaf turning from green to orange">
      <defs>
        <linearGradient id="lsLeafGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6E8B3D" />
          <stop offset="45%" stopColor="#D9A23A" />
          <stop offset="100%" stopColor="#B4441F" />
        </linearGradient>
      </defs>
      <path
        fill="url(#lsLeafGrad)"
        d="M110 8 L124 58 L160 40 L150 82 L204 74 L176 112 L212 132 L164 142 L178 188 L128 160 L118 222 L102 222 L92 160 L42 188 L56 142 L8 132 L44 112 L16 74 L70 82 L60 40 L96 58 Z"
      />
      <path d="M110 30 L110 252" stroke="#5A2A12" strokeWidth="4" strokeLinecap="round" />
      <path d="M110 120 L58 92 M110 120 L162 92 M110 150 L66 160 M110 150 L154 160" stroke="#5A2A12" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function OrbitFigure() {
  return (
    <svg viewBox="0 0 640 300" role="img" aria-label="Earth orbiting the sun with the September equinox marked">
      <ellipse cx="320" cy="150" rx="250" ry="105" fill="none" stroke="var(--ls-line)" strokeWidth="2" strokeDasharray="6 6" />
      <circle cx="320" cy="150" r="34" fill="#E8B23A" />
      <circle cx="320" cy="150" r="46" fill="none" stroke="#E8B23A" strokeOpacity="0.35" strokeWidth="8" />
      <text x="320" y="210" textAnchor="middle" className="ls-svg-label">SUN</text>

      {/* Earth at the September equinox, right side of the orbit */}
      <g transform="translate(570 150)">
        <circle r="20" fill="#2F6E9E" />
        <path d="M-20 0 A20 20 0 0 1 20 0" fill="#1D3F5C" transform="rotate(90)" />
        <line x1="-9" y1="-30" x2="9" y2="30" stroke="var(--ls-ink)" strokeWidth="2" />
      </g>
      <text x="620" y="98" textAnchor="end" className="ls-svg-label">SEP EQUINOX</text>
      <text x="620" y="114" textAnchor="end" className="ls-svg-small">Sep 22, 8:05 PM ET (2026)</text>

      {/* Earth one week-ish later, Oct 1 */}
      <g transform="translate(543 198)">
        <circle r="14" fill="#B4441F" />
      </g>
      <text x="470" y="262" textAnchor="middle" className="ls-svg-label ls-svg-accent">OCT 1</text>
      <path d="M492 254 L532 208" stroke="var(--ls-accent)" strokeWidth="1.5" />

      <text x="20" y="22" className="ls-svg-small">The equinox is one instant in an orbit.</text>
      <text x="20" y="38" className="ls-svg-small">In London it already happened on Sep 23.</text>
    </svg>
  );
}

function chartX(doy) {
  return 60 + ((doy - DOY.jun1) / (DOY.nov30 - DOY.jun1)) * 550;
}
function chartY(temp) {
  return 260 - ((temp - 55) / (95 - 55)) * 220;
}

export function TempFigure() {
  const points = [];
  for (let d = DOY.jun1; d <= DOY.nov30; d += 2) {
    points.push(`${chartX(d).toFixed(1)},${chartY(avgHighOn(d)).toFixed(1)}`);
  }
  const marks = [
    { doy: DOY.sep22, label: 'SEP 22', tone: 'mute' },
    { doy: DOY.oct1, label: 'OCT 1', tone: 'accent' },
  ];
  const months = [['JUN', 152], ['JUL', 182], ['AUG', 213], ['SEP', 244], ['OCT', 274], ['NOV', 305]];

  return (
    <svg viewBox="0 0 640 300" role="img" aria-label="Average daily high temperature in Chattanooga from June through November">
      {[60, 70, 80, 90].map(t => (
        <g key={t}>
          <line x1="60" x2="610" y1={chartY(t)} y2={chartY(t)} stroke="var(--ls-line)" strokeWidth="1" />
          <text x="50" y={chartY(t) + 4} textAnchor="end" className="ls-svg-small">{t}°</text>
        </g>
      ))}
      <rect x="60" y={chartY(95)} width="550" height={chartY(80) - chartY(95)} fill="#E8B23A" opacity="0.10" />
      <text x="606" y={chartY(92)} textAnchor="end" className="ls-svg-small">80°+ = still summer</text>

      <polyline points={points.join(' ')} fill="none" stroke="var(--ls-ink)" strokeWidth="3" strokeLinejoin="round" />

      {marks.map(m => {
        const x = chartX(m.doy);
        const y = chartY(avgHighOn(m.doy));
        const cls = m.tone === 'accent' ? 'ls-svg-accent' : '';
        return (
          <g key={m.label}>
            <line x1={x} x2={x} y1={y} y2="260" stroke={m.tone === 'accent' ? 'var(--ls-accent)' : 'var(--ls-mute)'} strokeDasharray="4 4" />
            <circle cx={x} cy={y} r="6" fill={m.tone === 'accent' ? 'var(--ls-accent)' : 'var(--ls-paper)'} stroke="var(--ls-ink)" strokeWidth="2" />
            <text x={x + (m.tone === 'accent' ? 10 : -10)} y={m.tone === 'accent' ? y - 12 : y + 26} textAnchor={m.tone === 'accent' ? 'start' : 'end'} className={`ls-svg-label ${cls}`}>
              {m.label} · {Math.round(avgHighOn(m.doy))}°
            </text>
          </g>
        );
      })}

      {months.map(([name, d]) => (
        <text key={name} x={chartX(d)} y="282" className="ls-svg-small">{name}</text>
      ))}
    </svg>
  );
}

// Daylight at about 35 deg N (Soddy-Daisy), sunrise to sunset, rounded.
const DAYLIGHT = [
  { day: 'SEP 1', mins: 12 * 60 + 51 },
  { day: 'SEP 22', mins: 12 * 60 + 8 },
  { day: 'SEP 26', mins: 12 * 60 },
  { day: 'OCT 1', mins: 11 * 60 + 51 },
];

export function DaylightFigure() {
  return (
    <svg viewBox="0 0 640 250" role="img" aria-label="Hours of daylight versus night on four dates in Soddy-Daisy">
      {DAYLIGHT.map((row, i) => {
        const y = 24 + i * 54;
        // Zoomed around 12h so a few minutes are visible: each minute = 3px.
        const dayW = 220 + (row.mins - 720) * 3;
        const h = Math.floor(row.mins / 60);
        const m = row.mins % 60;
        const isOct = row.day === 'OCT 1';
        return (
          <g key={row.day}>
            <text x="0" y={y + 22} className={`ls-svg-label ${isOct ? 'ls-svg-accent' : ''}`}>{row.day}</text>
            <rect x="90" y={y} width={dayW} height="32" fill="#E8B23A" rx="3" />
            <rect x={90 + dayW} y={y} width={440 - dayW} height="32" fill="#1D2B44" rx="3" />
            <line x1="310" x2="310" y1={y - 4} y2={y + 36} stroke="var(--ls-accent)" strokeWidth="2" />
            <text x="545" y={y + 22} className="ls-svg-small">{h}h {String(m).padStart(2, '0')}m sun</text>
          </g>
        );
      })}
      <text x="310" y="240" textAnchor="middle" className="ls-svg-small">zoomed in around 12 hours · red line = exactly 12h of sun</text>
    </svg>
  );
}

export function LagFigure() {
  // Two sine-ish curves: sunlight peaks at the solstice, temperature about a month later.
  const sun = [];
  const temp = [];
  for (let x = 0; x <= 560; x += 8) {
    const t = (x / 560) * Math.PI * 2;
    sun.push(`${40 + x},${140 - Math.cos(t - Math.PI * 0.5) * 80}`);
    temp.push(`${40 + x},${140 - Math.cos(t - Math.PI * 0.5 - 0.52) * 70}`);
  }
  return (
    <svg viewBox="0 0 640 280" role="img" aria-label="Sunlight peaks at the solstice but temperature peaks about a month later">
      <polyline points={sun.join(' ')} fill="none" stroke="#E8B23A" strokeWidth="4" />
      <polyline points={temp.join(' ')} fill="none" stroke="var(--ls-accent)" strokeWidth="4" />
      <line x1="180" x2="180" y1="40" y2="240" stroke="var(--ls-line)" strokeDasharray="4 4" />
      <line x1="228" x2="228" y1="40" y2="240" stroke="var(--ls-line)" strokeDasharray="4 4" />
      <text x="176" y="258" textAnchor="end" className="ls-svg-small">JUN 21 most sun</text>
      <text x="232" y="258" className="ls-svg-small ls-svg-accent">LATE JUL hottest</text>
      <path d="M184 48 L224 48" stroke="var(--ls-ink)" strokeWidth="2" markerEnd="url(#lsArrow)" />
      <text x="204" y="36" textAnchor="middle" className="ls-svg-label">~1 month</text>
      <defs>
        <marker id="lsArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" fill="var(--ls-ink)" />
        </marker>
      </defs>
      <g transform="translate(440 40)">
        <rect width="14" height="4" y="4" fill="#E8B23A" />
        <text x="22" y="10" className="ls-svg-small">sunlight</text>
        <rect width="14" height="4" y="24" fill="var(--ls-accent)" />
        <text x="22" y="30" className="ls-svg-small">temperature</text>
      </g>
    </svg>
  );
}

const LEAF_STAGES = [
  { label: 'SEP 22', color: '#5E7F34', note: 'green' },
  { label: 'OCT 1', color: '#A9A23A', note: 'first turn' },
  { label: 'MID OCT', color: '#D98A2B', note: 'color shows' },
  { label: 'LATE OCT', color: '#B4441F', note: 'peak in TN' },
  { label: 'NOV', color: '#6B3A22', note: 'falling' },
];

export function LeafFigure() {
  return (
    <svg viewBox="0 0 640 200" role="img" aria-label="Tennessee leaves stay green through September and turn in October">
      <line x1="40" x2="600" y1="120" y2="120" stroke="var(--ls-line)" strokeWidth="2" />
      {LEAF_STAGES.map((s, i) => {
        const x = 70 + i * 125;
        return (
          <g key={s.label} transform={`translate(${x} 0)`}>
            <path
              d="M0 40 C 26 52, 30 92, 0 112 C -30 92, -26 52, 0 40 Z"
              fill={s.color}
              transform={`rotate(${i * 9 - 10} 0 76)`}
            />
            <line x1="0" x2="0" y1="104" y2="120" stroke="#5A2A12" strokeWidth="2" />
            <text y="150" textAnchor="middle" className={`ls-svg-label ${s.label === 'OCT 1' ? 'ls-svg-accent' : ''}`}>{s.label}</text>
            <text y="168" textAnchor="middle" className="ls-svg-small">{s.note}</text>
          </g>
        );
      })}
    </svg>
  );
}
