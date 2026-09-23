import { P, mono } from '../theme';

// Shared inline-SVG charts for the Range Ops redesign (Dashboard team
// trajectory, Shooter Profile performance chart, Lineup projections).
// Same "no charting library" posture as StatsTab.jsx's LineChart — the
// dataset (one school team, a season or two of matches) never justifies the
// bundle cost of a real charting lib. TrendChart generalizes that one to
// multiple series + an optional dashed target line + a "big" mode for the
// Dashboard's full-bleed card.

export function TrendChart({ series, labels, target, big = false, valueFmt = (v) => Math.round(v) }) {
  const W = big ? 1000 : 640;
  const H = big ? 420 : 220;
  const fs = big ? 12 : 10;
  const pad = { left: big ? 50 : 40, right: big ? 20 : 12, top: big ? 22 : 14, bottom: big ? 34 : 26 };
  const allVals = series.flatMap((s) => s.values.filter((v) => v != null));
  if (target != null) allVals.push(target);
  if (!allVals.length) {
    return <div style={{ fontFamily: mono, fontSize: 12, color: P.mute, padding: '30px 0' }}>No data yet.</div>;
  }
  const step = niceStep(allVals);
  const mn = Math.floor((Math.min(...allVals) - step / 2) / step) * step;
  const mx = Math.ceil((Math.max(...allVals) + step / 2) / step) * step;
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const n = labels.length;
  const x = (i) => pad.left + (n > 1 ? (i * innerW) / (n - 1) : innerW / 2);
  const y = (v) => pad.top + innerH - ((v - mn) / (mx - mn || 1)) * innerH;

  const gridLines = [];
  for (let i = 0; i <= 4; i++) {
    const v = mn + ((mx - mn) * i) / 4;
    const gy = y(v);
    gridLines.push(
      <line key={`g${i}`} x1={pad.left} x2={W - pad.right} y1={gy} y2={gy} stroke={i === 0 ? 'rgba(201,169,97,0.35)' : 'rgba(201,169,97,0.1)'} strokeDasharray={i === 0 ? undefined : '2 5'} />,
      <text key={`gt${i}`} x={pad.left - 8} y={gy + 4} textAnchor="end" fontSize={fs} fill={P.mute} fontFamily={mono}>{valueFmt(v)}</text>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: 'auto', display: 'block' }}>
      {gridLines}
      {labels.map((l, i) => (
        <text key={`x${i}`} x={x(i)} y={H - pad.bottom + (big ? 22 : 16)} textAnchor="middle" fontSize={fs - 1} fill={P.mute} fontFamily={mono} letterSpacing={1}>{l}</text>
      ))}
      {target != null && (
        <line x1={pad.left} x2={W - pad.right} y1={y(target)} y2={y(target)} stroke={P.win} strokeDasharray="6 5" strokeWidth={1} opacity={0.8} />
      )}
      {series.map((s, si) => {
        const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v), v])).filter(Boolean);
        if (!pts.length) return null;
        const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        const areaD = `${d} L${pts[pts.length - 1][0].toFixed(1)},${H - pad.bottom} L${pts[0][0].toFixed(1)},${H - pad.bottom} Z`;
        const best = Math.max(...pts.map((p) => p[2]));
        return (
          <g key={si}>
            {s.area !== false && (
              <>
                <defs>
                  <linearGradient id={`tc-grad-${si}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <path d={areaD} fill={`url(#tc-grad-${si})`} />
              </>
            )}
            <path d={d} fill="none" stroke={s.color} strokeWidth={big ? 3 : 2} strokeLinejoin="round" />
            {pts.map((p, i) => {
              const isBest = s.markBest && p[2] === best;
              return (
                <circle key={i} cx={p[0]} cy={p[1]} r={isBest ? (big ? 7 : 5) : (big ? 5 : 3.5)} fill={isBest ? s.color : P.deep} stroke={s.color} strokeWidth={2} />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function niceStep(vals) {
  const range = Math.max(...vals) - Math.min(...vals) || 10;
  const raw = range / 5;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return step * mag;
}

export function Sparkline({ values, width = 84, height = 22, color = P.gold }) {
  const v = values.filter((x) => x != null);
  if (v.length < 2) return <svg width={width} height={height} />;
  const mn = Math.min(...v), mx = Math.max(...v), range = mx - mn || 1;
  const pts = v.map((x, i) => [(i / (v.length - 1)) * (width - 4) + 2, height - 3 - ((x - mn) / range) * (height - 6)]);
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
      <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} fill="none" stroke={color} strokeWidth={1.5} />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
    </svg>
  );
}

export function downloadCsv(filename, rows) {
  const blob = new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

