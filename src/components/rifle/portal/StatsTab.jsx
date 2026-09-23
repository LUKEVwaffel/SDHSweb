import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { P, mono } from '../theme';
import { SectionLabel, Card } from './ui';

// Charts + season comparisons over rifle_scores. Plain inline SVG — the
// dataset (one school team, a season or two of matches) is small enough
// that a charting library would be pure overhead for what's two shapes:
// a line (one shooter's total over time) and a bar (team average by season).
const label = { fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.1em' };
const inputStyle = { background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 13, padding: '9px 11px', outline: 'none' };
const CHART_W = 640;
const CHART_H = 220;
const PAD = { top: 16, right: 16, bottom: 32, left: 44 };

function seasonOf(dates) {
  const m = (dates || '').match(/\b(20\d{2})\b/);
  return m ? m[1] : 'Undated';
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function LineChart({ points, valueKey = 'total', color = P.gold }) {
  const vals = points.map((p) => p[valueKey]).filter((v) => v != null && !Number.isNaN(v));
  if (vals.length === 0) {
    return <div style={{ fontFamily: mono, fontSize: 12, color: P.mute, padding: '30px 0' }}>No total scores recorded yet for this selection.</div>;
  }
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  const xy = (i, v) => {
    const x = PAD.left + i * stepX;
    const y = PAD.top + innerH - ((v - min) / range) * innerH;
    return [x, y];
  };
  const path = points
    .map((p, i) => (p[valueKey] == null ? null : xy(i, p[valueKey])))
    .reduce((acc, pt, i) => {
      if (!pt) return acc;
      return acc + `${acc ? 'L' : 'M'}${pt[0].toFixed(1)},${pt[1].toFixed(1)} `;
    }, '');
  const avg = round1(vals.reduce((a, b) => a + b, 0) / vals.length);
  const [avgX, avgY] = [PAD.left, PAD.top + innerH - ((avg - min) / range) * innerH];

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={CHART_H - PAD.bottom} stroke={P.hair} strokeWidth={1} />
      <line x1={PAD.left} y1={CHART_H - PAD.bottom} x2={CHART_W - PAD.right} y2={CHART_H - PAD.bottom} stroke={P.hair} strokeWidth={1} />
      <line x1={avgX} y1={avgY} x2={CHART_W - PAD.right} y2={avgY} stroke={P.hairStrong} strokeWidth={1} strokeDasharray="4 4" />
      <text x={CHART_W - PAD.right} y={avgY - 4} textAnchor="end" fontFamily={mono} fontSize={10} fill={P.mute}>avg {avg}</text>
      <text x={PAD.left - 6} y={PAD.top + 4} textAnchor="end" fontFamily={mono} fontSize={10} fill={P.mute}>{round1(max)}</text>
      <text x={PAD.left - 6} y={CHART_H - PAD.bottom} textAnchor="end" fontFamily={mono} fontSize={10} fill={P.mute}>{round1(min)}</text>
      <path d={path.trim()} fill="none" stroke={color} strokeWidth={2} />
      {points.map((p, i) => {
        if (p[valueKey] == null) return null;
        const [x, y] = xy(i, p[valueKey]);
        return <circle key={i} cx={x} cy={y} r={3.5} fill={P.ink} stroke={color} strokeWidth={2} />;
      })}
      {points.map((p, i) => {
        const x = PAD.left + i * stepX;
        if (points.length > 14 && i % Math.ceil(points.length / 14) !== 0) return null;
        return <text key={i} x={x} y={CHART_H - PAD.bottom + 16} textAnchor="middle" fontFamily={mono} fontSize={9} fill={P.faint}>W{p.week}</text>;
      })}
    </svg>
  );
}

function BarChart({ bars, valueKey = 'value', labelKey = 'label' }) {
  const vals = bars.map((b) => b[valueKey]).filter((v) => v != null);
  if (vals.length === 0) {
    return <div style={{ fontFamily: mono, fontSize: 12, color: P.mute, padding: '30px 0' }}>Not enough data yet.</div>;
  }
  const max = Math.max(...vals);
  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const bw = Math.min(60, innerW / bars.length - 16);

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1={PAD.left} y1={CHART_H - PAD.bottom} x2={CHART_W - PAD.right} y2={CHART_H - PAD.bottom} stroke={P.hair} strokeWidth={1} />
      {bars.map((b, i) => {
        const slot = innerW / bars.length;
        const x = PAD.left + i * slot + (slot - bw) / 2;
        const h = b[valueKey] == null ? 0 : (b[valueKey] / max) * innerH;
        const y = CHART_H - PAD.bottom - h;
        return (
          <g key={b[labelKey]}>
            <rect x={x} y={y} width={bw} height={h} fill={P.gold} opacity={0.85} />
            {b[valueKey] != null && <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontFamily={mono} fontSize={10} fill={P.cream}>{round1(b[valueKey])}</text>}
            <text x={x + bw / 2} y={CHART_H - PAD.bottom + 16} textAnchor="middle" fontFamily={mono} fontSize={10} fill={P.mute}>{b[labelKey]}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function StatsTab() {
  const [shooters, setShooters] = useState([]);
  const [matches, setMatches] = useState([]);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [shooterSearch, setShooterSearch] = useState('');
  const [shooterId, setShooterId] = useState('');

  const load = useCallback(async () => {
    setErr('');
    const [{ data: s, error: sErr }, { data: m, error: mErr }, { data: sc, error: scErr }] = await Promise.all([
      SB.from('rifle_shooters').select('id, name, active').order('name'),
      SB.from('rifle_matches').select('*').order('week'),
      SB.from('rifle_scores').select('*'),
    ]);
    if (sErr || mErr || scErr) { setErr((sErr || mErr || scErr).message); setLoading(false); return; }
    setShooters(s || []);
    setMatches(m || []);
    setScores(sc || []);
    setLoading(false);
    if (!shooterId && s?.length) setShooterId(s[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredShooters = useMemo(() => {
    const q = shooterSearch.trim().toLowerCase();
    return q ? shooters.filter((s) => s.name.toLowerCase().includes(q)) : shooters;
  }, [shooters, shooterSearch]);

  const shooterPoints = useMemo(() => {
    return scores
      .filter((sc) => sc.shooter_id === shooterId)
      .map((sc) => ({ ...sc, match: matches.find((m) => m.id === sc.match_id) }))
      .filter((sc) => sc.match)
      .sort((a, b) => a.match.week - b.match.week)
      .map((sc) => ({ week: sc.match.week, total: sc.total, prone: sc.prone, standing: sc.standing, kneeling: sc.kneeling }));
  }, [scores, matches, shooterId]);

  const seasonBars = useMemo(() => {
    const bySeason = new Map();
    for (const sc of scores) {
      if (sc.total == null) continue;
      const m = matches.find((mm) => mm.id === sc.match_id);
      const season = seasonOf(m?.dates);
      if (!bySeason.has(season)) bySeason.set(season, []);
      bySeason.get(season).push(sc.total);
    }
    return Array.from(bySeason.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([season, vals]) => ({ label: season, value: vals.reduce((a, b) => a + b, 0) / vals.length, count: vals.length }));
  }, [scores, matches]);

  const shooterStats = useMemo(() => {
    const totals = shooterPoints.map((p) => p.total).filter((v) => v != null);
    if (totals.length === 0) return null;
    return {
      avg: round1(totals.reduce((a, b) => a + b, 0) / totals.length),
      best: Math.max(...totals),
      matches: totals.length,
    };
  }, [shooterPoints]);

  const selectedShooter = shooters.find((s) => s.id === shooterId);

  if (loading) return <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>Loading stats…</div>;
  if (err) return <div style={{ fontFamily: mono, fontSize: 12, color: P.red }}>{err}</div>;

  return (
    <div>
      <SectionLabel tag="// ANALYSIS · CHARTS" title="Team &amp; Shooter Stats" sub="Live season charts pulled from the same match/score data the Scores tab edits." />

      <div style={{ ...label, marginBottom: 10 }}>TEAM AVERAGE TOTAL BY SEASON</div>
      <Card style={{ marginBottom: 30 }} padding={16}>
        <BarChart bars={seasonBars} />
      </Card>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ ...label, marginBottom: 6 }}>SEARCH SHOOTER</div>
          <input value={shooterSearch} onChange={(e) => setShooterSearch(e.target.value)} placeholder="Type a name…" style={{ ...inputStyle, minWidth: 180 }} />
        </div>
        <div>
          <div style={{ ...label, marginBottom: 6 }}>SHOOTER</div>
          <select value={shooterId} onChange={(e) => setShooterId(e.target.value)} style={{ ...inputStyle, minWidth: 200 }}>
            {filteredShooters.length === 0 && <option value="">No match</option>}
            {filteredShooters.map((s) => <option key={s.id} value={s.id}>{s.name}{s.active ? '' : ' (inactive)'}</option>)}
          </select>
        </div>
        {shooterStats && (
          <div style={{ fontFamily: mono, fontSize: 12, color: P.mute, display: 'flex', gap: 18 }}>
            <span><span style={{ color: P.gold }}>{shooterStats.avg}</span> avg</span>
            <span><span style={{ color: P.gold }}>{shooterStats.best}</span> best</span>
            <span><span style={{ color: P.gold }}>{shooterStats.matches}</span> matches</span>
          </div>
        )}
      </div>

      <div style={{ ...label, marginBottom: 10 }}>{selectedShooter ? selectedShooter.name.toUpperCase() : 'SHOOTER'} — TOTAL SCORE OVER TIME</div>
      <Card padding={16}>
        <LineChart points={shooterPoints} />
      </Card>
    </div>
  );
}
