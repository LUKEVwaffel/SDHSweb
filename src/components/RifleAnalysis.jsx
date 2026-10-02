import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase as SB } from '../lib/supabaseClient';
import { SEASON_META, staticSeason } from './rifleData';
import { buildSeason, buildNarrative } from './rifle/seasonStats';
import { schoolYearOf, currentSchoolYear } from './rifle/portal/rifleStats';

const P = {
  navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', faint: 'rgba(244,236,216,0.35)',
  hair: 'rgba(201,169,97,0.22)', hairStrong: 'rgba(201,169,97,0.5)',
  win: '#7EC87E', warn: '#E0885A',
};

const MONO = "'JetBrains Mono', monospace";
const HEAD = 'Oswald, sans-serif';
const BODY = 'Inter, sans-serif';

const seasonLabel = (sy) => { const [a, b] = sy.split('-'); return b ? `${a}–${b.slice(2)}` : sy; };

// Live season data: every season that has at least one score, newest first.
// Falls back to the static 2025-26 cards if the read fails, so the section
// never renders empty.
function useRifleSeasons() {
  const [state, setState] = useState({ loading: true, rows: null, error: null });
  useEffect(() => {
    let live = true;
    Promise.all([
      SB.from('rifle_matches').select('id, week, dates, opponent, location, created_at'),
      SB.from('rifle_shooters').select('id, name, rifle_no, active'),
      SB.from('rifle_scores').select('shooter_id, match_id, prone, standing, kneeling, total, bulls'),
    ]).then(([m, s, sc]) => {
      if (!live) return;
      const error = m.error || s.error || sc.error;
      if (error) { console.error('rifle season load', error); setState({ loading: false, rows: null, error }); return; }
      setState({ loading: false, rows: { matches: m.data || [], shooters: s.data || [], scores: sc.data || [] }, error: null });
    });
    return () => { live = false; };
  }, []);

  return useMemo(() => {
    if (state.loading) return { loading: true, seasons: [], build: null };
    if (!state.rows) return { loading: false, seasons: ['2025-2026'], build: () => staticSeason(), offline: true };
    const { matches, shooters, scores } = state.rows;
    const byId = new Map(matches.map((m) => [m.id, m]));
    const seasons = [...new Set(scores.map((sc) => byId.get(sc.match_id)).filter(Boolean).map(schoolYearOf))]
      .filter((sy) => sy !== 'Undated').sort().reverse();
    if (!seasons.length) return { loading: false, seasons: ['2025-2026'], build: () => staticSeason(), offline: true };
    const now = currentSchoolYear();
    const build = (season) => buildSeason({
      matches, shooters, scores, season, schoolYearOf, isCurrent: season >= now,
      meta: season === '2025-2026' ? { league: SEASON_META.league, squad: SEASON_META.squad } : {},
    });
    return { loading: false, seasons, build };
  }, [state]);
}

const TIER_COLOR = {
  Expert: P.bright,
  Sharpshooter: P.gold,
  Marksman: '#B9945A',
  'Not Qualified': P.faint,
  DNS: P.faint,
};

// ── Small pieces ─────────────────────────────────────────────────────────────

function Brackets({ size = 14, opacity = 0.35 }) {
  const s = `1px solid rgba(201,169,97,${opacity})`;
  return (
    <>
      {[
        { top: 0, left: 0, borderTop: s, borderLeft: s },
        { top: 0, right: 0, borderTop: s, borderRight: s },
        { bottom: 0, left: 0, borderBottom: s, borderLeft: s },
        { bottom: 0, right: 0, borderBottom: s, borderRight: s },
      ].map((st, i) => (
        <div key={i} style={{ position: 'absolute', width: size, height: size, ...st, pointerEvents: 'none' }} />
      ))}
    </>
  );
}

function ClassChip({ tier, range, small }) {
  const c = TIER_COLOR[tier] || P.gold;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'baseline', gap: 6,
      border: `1px solid ${c}66`, background: `${c}12`,
      padding: small ? '2px 7px' : '4px 10px', whiteSpace: 'nowrap',
    }}>
      <span style={{ fontFamily: MONO, fontSize: small ? 8 : 9, color: c, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
        {tier}
      </span>
      {range && range !== '—' && (
        <span style={{ fontFamily: MONO, fontSize: small ? 7 : 8, color: P.faint, letterSpacing: '0.1em' }}>{range}</span>
      )}
    </span>
  );
}

function Stat({ label, value, sub, tone }) {
  const color = tone === 'up' ? P.win : tone === 'down' ? P.warn : P.cream;
  return (
    <div style={{ border: `1px solid ${P.hair}`, padding: '10px 12px', background: 'rgba(10,22,40,0.5)' }}>
      <div style={{ fontFamily: MONO, fontSize: 8, color: P.gold, letterSpacing: '0.2em', opacity: 0.7, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: HEAD, fontSize: 22, color, letterSpacing: '0.02em', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontFamily: MONO, fontSize: 8, color: P.faint, letterSpacing: '0.1em', marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

// Position average vs. team average, 0–100 scale.
function PositionBar({ label, value, teamValue, best, worst }) {
  const pct = Math.max(0, Math.min(100, value));
  const teamPct = Math.max(0, Math.min(100, teamValue));
  const barColor = best ? P.win : worst ? P.warn : P.gold;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: P.cream, letterSpacing: '0.14em' }}>
          {label.toUpperCase()}
          {best && <span style={{ color: P.win, marginLeft: 6 }}>▲ TOP</span>}
          {worst && <span style={{ color: P.warn, marginLeft: 6 }}>▼ LOW</span>}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: P.cream }}>
          {value}
          <span style={{ color: P.faint }}> / {teamValue} team</span>
        </span>
      </div>
      <div style={{ position: 'relative', height: 8, background: 'rgba(244,236,216,0.06)', border: `1px solid ${P.hair}` }}>
        <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: `${barColor}`, opacity: 0.55 }} />
        <div style={{
          position: 'absolute', top: -2, bottom: -2, left: `${teamPct}%`, width: 1.5,
          background: P.cream, opacity: 0.7,
        }} />
      </div>
    </div>
  );
}

// Overall-aggregate line across all 10 weeks; gaps where the cadet did not fire.
function Sparkline({ weeks, avg, teamAvg, width = 560, height = 132 }) {
  const vals = weeks.filter((w) => w.fired).map((w) => w.tot).concat(teamAvg ?? []);
  const Y_MIN = Math.floor((Math.min(...vals) - 10) / 10) * 10;
  const Y_MAX = Math.ceil((Math.max(...vals) + 8) / 10) * 10;
  const span = Math.max(1, weeks.length - 1);
  const padL = 34;
  const padR = 10;
  const padT = 12;
  const padB = 20;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const x = (i) => (weeks.length === 1 ? padL + innerW / 2 : padL + ((i - 1) / span) * innerW);
  const y = (v) => padT + innerH - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * innerH;

  const pts = weeks.filter((w) => w.fired).map((w) => ({ i: w.idx, wk: w.week, v: w.tot, b: w.b }));

  // Break the polyline into contiguous runs so byes render as gaps.
  const runs = [];
  let run = [];
  weeks.forEach((w) => {
    if (w.fired) {
      run.push({ i: w.idx, v: w.tot });
    } else if (run.length) {
      runs.push(run);
      run = [];
    }
  });
  if (run.length) runs.push(run);

  const step = Y_MAX - Y_MIN > 80 ? 30 : 10;
  const gridVals = [];
  for (let g = Math.ceil(Y_MIN / step) * step; g < Y_MAX; g += step) gridVals.push(g);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img"
      aria-label={`Aggregate by week: ${pts.map((p) => `week ${p.wk} ${p.v}`).join(', ')}`}
      style={{ display: 'block', maxWidth: '100%' }}>
      {gridVals.map((g) => (
        <g key={g}>
          <line x1={padL} y1={y(g)} x2={width - padR} y2={y(g)} stroke={P.hair} strokeWidth="0.75" />
          <text x={4} y={y(g) + 3} fill={P.faint} fontFamily={MONO} fontSize="8">{g}</text>
        </g>
      ))}

      {/* season average reference */}
      <line x1={padL} y1={y(avg)} x2={width - padR} y2={y(avg)} stroke={P.gold} strokeWidth="1" strokeDasharray="4 3" opacity="0.8" />
      <text x={width - padR} y={y(avg) - 4} fill={P.gold} fontFamily={MONO} fontSize="8" textAnchor="end">
        AVG {avg}
      </text>
      {/* team average reference */}
      {teamAvg != null && <line x1={padL} y1={y(teamAvg)} x2={width - padR} y2={y(teamAvg)} stroke={P.cream} strokeWidth="0.75" opacity="0.3" />}

      {runs.map((r, i) => (
        <polyline
          key={i}
          points={r.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')}
          fill="none" stroke={P.bright} strokeWidth="1.6"
        />
      ))}

      {pts.map((p) => (
        <g key={p.i}>
          <circle cx={x(p.i)} cy={y(p.v)} r={p.b >= 4 ? 3.6 : 2.6}
            fill={p.b >= 4 ? P.bright : P.deep} stroke={P.bright} strokeWidth="1.4" />
          <text x={x(p.i)} y={height - 6} fill={P.faint} fontFamily={MONO} fontSize="8" textAnchor="middle">
            {p.wk}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ── Week-by-week table ───────────────────────────────────────────────────────

function WeekTable({ weeks }) {
  const cols = ['WK', 'DATES', 'OPPONENT', 'PRONE', 'STAND', 'KNEEL', 'AGG', "BULL", 'Δ'];
  let prev = null;
  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${P.hair}` }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 620 }}>
        <thead>
          <tr style={{ background: P.deep }}>
            {cols.map((c, i) => (
              <th key={c} style={{
                fontFamily: MONO, fontSize: 8, color: P.gold, letterSpacing: '0.16em', opacity: 0.7,
                textAlign: i < 3 ? 'left' : 'right', padding: '8px 10px',
                borderBottom: `1px solid ${P.hair}`, whiteSpace: 'nowrap',
              }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => {
            const delta = w.fired && prev != null ? Number((w.tot - prev).toFixed(1)) : null;
            if (w.fired) prev = w.tot;
            return (
              <tr key={w.idx} style={{ background: w.fired ? 'transparent' : 'rgba(244,236,216,0.02)' }}>
                <td style={cell('left')}>{String(w.week).padStart(2, '0')}</td>
                <td style={{ ...cell('left'), color: P.faint }}>{w.dates}</td>
                <td style={{ ...cell('left'), color: P.mute }}>{w.opp || '—'}</td>
                {w.fired ? (
                  <>
                    <td style={cell('right')}>{w.p != null ? w.p.toFixed(1) : '—'}</td>
                    <td style={cell('right')}>{w.s != null ? w.s.toFixed(1) : '—'}</td>
                    <td style={cell('right')}>{w.k != null ? w.k.toFixed(1) : '—'}</td>
                    <td style={{ ...cell('right'), color: P.cream, fontFamily: HEAD, fontSize: 14 }}>{w.tot.toFixed(1)}</td>
                    <td style={cell('right')}>{w.b}</td>
                    <td style={{ ...cell('right'), color: delta == null ? P.faint : delta >= 0 ? P.win : P.warn }}>
                      {delta == null ? '—' : `${delta >= 0 ? '+' : ''}${delta}`}
                    </td>
                  </>
                ) : (
                  <td colSpan={6} style={{ ...cell('right'), color: P.faint, letterSpacing: '0.2em', fontSize: 8 }}>
                    — DID NOT FIRE —
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function cell(align) {
  return {
    fontFamily: MONO, fontSize: 10, color: P.cream, textAlign: align,
    padding: '7px 10px', borderBottom: `1px solid ${P.hair}`, whiteSpace: 'nowrap',
  };
}

// ── Quick-glance leaderboard — every tier/avg/best visible with zero clicks ──

function QuickTable({ ordered, onJump, meta }) {
  const cols = ['#', 'NAME', 'CLASS', 'AVG', 'TOP SHOT', 'TREND', 'FIRED'];
  return (
    <div style={{ border: `1px solid ${P.hair}`, background: P.deep, overflowX: 'auto', marginBottom: 20 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={c} style={{
                fontFamily: MONO, fontSize: 8, color: P.gold, letterSpacing: '0.16em', opacity: 0.7,
                textAlign: i <= 1 ? 'left' : 'right', padding: '9px 12px',
                borderBottom: `1px solid ${P.hair}`, whiteSpace: 'nowrap', background: P.navy,
              }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordered.map((s, i) => (
            <tr
              key={s.name}
              onClick={() => onJump(s.name)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => activate(e, () => onJump(s.name))}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(201,169,97,0.06)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={cell('left')}>{s.dns ? '—' : String(i + 1).padStart(2, '0')}</td>
              <td style={{ ...cell('left'), color: P.cream, fontFamily: HEAD, fontSize: 13, letterSpacing: '0.02em' }}>{s.name}</td>
              <td style={{ ...cell('right'), padding: '6px 12px' }}>
                {s.dns ? <span style={{ color: P.faint }}>DNS</span> : <ClassChip tier={s.classification.tier} range={s.classification.range} small />}
              </td>
              <td style={cell('right')}>{s.dns ? '—' : s.avg}</td>
              <td style={{ ...cell('right'), color: TIER_COLOR[s.classification?.tier] || P.cream }}>{s.dns ? '—' : s.best}</td>
              <td style={{ ...cell('right'), color: s.dns || s.firedCount < 2 ? P.faint : s.trend >= 0 ? P.win : P.warn }}>
                {s.dns || s.firedCount < 2 ? '—' : `${s.trend >= 0 ? '+' : ''}${s.trend}`}
              </td>
              <td style={cell('right')}>{s.dns ? '0' : s.firedCount}/{meta.matches}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function activate(e, fn) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fn();
  }
}

// ── Shooter dossier ──────────────────────────────────────────────────────────

function ShooterDossier({ shooter, rank, expanded, onToggle, team, meta }) {
  const s = shooter;
  const narrative = useMemo(() => buildNarrative(s, team, meta), [s, team, meta]);
  const tierColor = TIER_COLOR[s.classification.tier] || P.gold;

  return (
    <div style={{ border: `1px solid ${expanded ? P.hairStrong : P.hair}`, background: P.navy, position: 'relative', transition: 'border-color 0.2s' }}>
      <Brackets size={16} opacity={expanded ? 0.6 : 0.25} />

      {/* Summary row — click to expand */}
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        style={{
          width: '100%', display: 'grid', gridTemplateColumns: '46px 1fr auto', gap: 16, alignItems: 'center',
          padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
          color: 'inherit', fontFamily: BODY,
        }}
      >
        <div style={{ fontFamily: HEAD, fontSize: 26, color: rank <= 3 ? P.gold : P.faint, letterSpacing: '0.02em' }}>
          {s.dns ? '—' : String(rank).padStart(2, '0')}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: HEAD, fontSize: 21, color: P.cream, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {s.name}
            </span>
            {s.rifle != null && (
              <span style={{ fontFamily: MONO, fontSize: 8, color: P.faint, letterSpacing: '0.16em' }}>
                RIFLE {String(s.rifle).padStart(2, '0')}
              </span>
            )}
            <ClassChip tier={s.classification.tier} range={s.classification.range} small />
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: P.mute, letterSpacing: '0.1em', marginTop: 5 }}>
            {s.dns
              ? `NO CARD ON FILE · 0 / ${meta.matches} MATCHES`
              : `${s.avg} AVG · BEST ${s.best} (WK ${s.bestWeek}) · ${s.firedCount} / ${meta.matches} MATCHES${s.firedCount > 1 ? ` · ${s.trend >= 0 ? '+' : ''}${s.trend} PTS/MATCH` : ''}`}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {!s.dns && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: HEAD, fontSize: 30, color: P.cream, lineHeight: 1 }}>{s.avg}</div>
              <div style={{ fontFamily: MONO, fontSize: 8, color: P.faint, letterSpacing: '0.16em', marginTop: 3 }}>SEASON AVG</div>
            </div>
          )}
          <span style={{ fontFamily: MONO, fontSize: 14, color: P.gold, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
            ▸
          </span>
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: `1px solid ${P.hair}`, padding: '22px 20px 26px' }}>
          {s.dns ? (
            <p style={{ fontFamily: BODY, fontSize: 13, color: P.mute, lineHeight: 1.7, margin: 0 }}>
              {narrative[0]}
            </p>
          ) : (
            <>
              {/* Sparkline */}
              <div style={{ border: `1px solid ${P.hair}`, background: 'rgba(10,22,40,0.55)', padding: '10px 12px 4px', marginBottom: 18 }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: P.gold, letterSpacing: '0.2em', opacity: 0.7, marginBottom: 4 }}>
                  AGGREGATE BY WEEK · LARGER DOT = 4+ BULL'S-EYES
                </div>
                <Sparkline weeks={s.weeks} avg={s.avg} teamAvg={team.teamAvg} />
              </div>

              {/* Stat grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 18 }}>
                <Stat label="SEASON AVG" value={s.avg} sub={`of ~300`} />
                <Stat label="BEST CARD" value={s.best} sub={`week ${s.bestWeek}`} tone="up" />
                {s.firedCount > 1 && (
                  <>
                    <Stat label="LOW CARD" value={s.worst} sub={`week ${s.worstWeek}`} tone="down" />
                    <Stat label="1ST → LAST" value={`${s.delta >= 0 ? '+' : ''}${s.delta}`} sub={`${s.first} → ${s.last}`} tone={s.delta >= 0 ? 'up' : 'down'} />
                    <Stat label="TREND" value={`${s.trend >= 0 ? '+' : ''}${s.trend}`} sub="pts / match" tone={s.trend >= 0 ? 'up' : 'down'} />
                    <Stat label="CONSISTENCY" value={`±${s.stdev}`} sub="match-to-match" />
                    <Stat label="SPREAD" value={s.range} sub={`best − low`} />
                  </>
                )}
                <Stat label="BULL'S-EYES" value={s.bulls} sub={`${s.bullsPerMatch} / match`} />
              </div>

              {/* Position breakdown */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: P.gold, letterSpacing: '0.22em', opacity: 0.7, marginBottom: 10 }}>
                  POSITION AVERAGES · WHITE TICK = TEAM AVERAGE
                </div>
                {s.positions.filter((p) => p.value != null).map((p) => (
                  <PositionBar
                    key={p.key}
                    label={p.label}
                    value={p.value}
                    teamValue={team.teamPositions.find((t) => t.key === p.key)?.value ?? p.value}
                    best={p.key === s.posBest?.key}
                    worst={p.key === s.posWorst?.key}
                  />
                ))}
              </div>

              {/* Week table */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: P.gold, letterSpacing: '0.22em', opacity: 0.7, marginBottom: 10 }}>
                  MATCH LOG
                </div>
                <WeekTable weeks={s.weeks} />
              </div>

              {/* Narrative */}
              <div style={{ borderLeft: `2px solid ${tierColor}`, paddingLeft: 14 }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: P.gold, letterSpacing: '0.22em', opacity: 0.7, marginBottom: 8 }}>
                  SCOUTING NOTES
                </div>
                {narrative.map((para, i) => (
                  <p key={i} style={{ fontFamily: BODY, fontSize: 12.5, color: P.mute, lineHeight: 1.75, margin: i === 0 ? 0 : '10px 0 0' }}>
                    {para}
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Latest comp ──────────────────────────────────────────────────────────────

function LatestComp({ match, meta }) {
  if (!match) return null;
  const cols = ['#', 'SHOOTER', 'PRONE', 'STAND', 'KNEEL', 'AGG', 'X'];
  return (
    <section aria-label="Latest competition" style={{ border: `1px solid ${P.hairStrong}`, background: `linear-gradient(135deg, ${P.navy} 0%, ${P.deep} 100%)`, padding: '22px 22px 18px', marginBottom: 20, position: 'relative' }}>
      <Brackets size={18} opacity={0.55} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: P.gold, letterSpacing: '0.24em', marginBottom: 8 }}>
            {meta.complete ? `// FINAL MATCH · ${seasonLabel(meta.season)}` : `// LATEST COMP · ${seasonLabel(meta.season)}`}
          </div>
          <div style={{ fontFamily: HEAD, fontSize: 30, fontWeight: 700, color: P.cream, letterSpacing: '0.03em', lineHeight: 1.05 }}>
            WEEK {match.week}{match.opp ? ` · vs ${match.opp}` : ''}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: P.mute, letterSpacing: '0.1em', marginTop: 6 }}>
            {[match.dates, match.loc].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: P.gold, letterSpacing: '0.2em', opacity: 0.75 }}>TEAM AGG · TOP {match.countedShooters}</div>
            <div style={{ fontFamily: HEAD, fontSize: 44, color: P.bright, lineHeight: 1, marginTop: 4 }}>{match.teamAgg}</div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: P.faint, marginTop: 3 }}>/ {match.countedShooters * 300}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: P.gold, letterSpacing: '0.2em', opacity: 0.75 }}>BULL'S-EYES</div>
            <div style={{ fontFamily: HEAD, fontSize: 44, color: P.cream, lineHeight: 1, marginTop: 4 }}>{match.bulls}</div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: P.faint, marginTop: 3 }}>{match.rows.length} fired</div>
          </div>
        </div>
      </div>
      <div style={{ overflowX: 'auto', border: `1px solid ${P.hair}` }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 520 }}>
          <thead>
            <tr style={{ background: P.deep }}>
              {cols.map((c, i) => (
                <th key={c} style={{ fontFamily: MONO, fontSize: 8, color: P.gold, letterSpacing: '0.16em', opacity: 0.7, textAlign: i < 2 ? 'left' : 'right', padding: '8px 10px', borderBottom: `1px solid ${P.hair}`, whiteSpace: 'nowrap' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {match.rows.map((r, i) => (
              <tr key={r.name} style={{ background: i < 4 ? 'rgba(201,169,97,0.05)' : 'transparent' }}>
                <td style={{ ...cell('left'), color: i < 4 ? P.gold : P.faint }}>{String(i + 1).padStart(2, '0')}</td>
                <td style={{ ...cell('left'), fontFamily: HEAD, fontSize: 13, letterSpacing: '0.03em' }}>
                  {r.name}
                  <span style={{ marginLeft: 8, verticalAlign: 'middle' }}><ClassChip tier={r.tier} small /></span>
                </td>
                <td style={cell('right')}>{r.p != null ? r.p.toFixed(1) : '—'}</td>
                <td style={cell('right')}>{r.s != null ? r.s.toFixed(1) : '—'}</td>
                <td style={cell('right')}>{r.k != null ? r.k.toFixed(1) : '—'}</td>
                <td style={{ ...cell('right'), fontFamily: HEAD, fontSize: 15, color: P.cream }}>{r.tot.toFixed(1)}</td>
                <td style={cell('right')}>{r.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 8, color: P.faint, letterSpacing: '0.14em', marginTop: 8 }}>
        HIGHLIGHTED ROWS = TOP {match.countedShooters} · COUNT TOWARD TEAM AGGREGATE
      </div>
    </section>
  );
}

// ── Team overview ────────────────────────────────────────────────────────────

function TeamOverview({ team: t, meta }) {
  const cards = [
    { label: 'ROSTER', value: t.rosterCount, sub: `${t.activeCount} fired · ${t.dnsCount} ${meta.complete ? 'DNS' : 'yet to fire'}` },
    { label: 'CARDS SHOT', value: t.matchesFired, sub: `across ${meta.matches} match${meta.matches === 1 ? '' : 'es'}` },
    t.teamAvg != null && { label: 'TEAM MATCH AVG', value: t.teamAvg, sub: 'all cards pooled' },
    { label: "BULL'S-EYES", value: t.totalBulls, sub: 'team total' },
    t.topShooter && { label: 'TOP AVERAGE', value: t.topShooter.avg, sub: t.topShooter.name },
    t.mostImproved && { label: 'MOST IMPROVED', value: `${t.mostImproved.delta >= 0 ? '+' : ''}${t.mostImproved.delta}`, sub: `${t.mostImproved.name} · 1st→last` },
    t.mostConsistent && { label: 'MOST CONSISTENT', value: `±${t.mostConsistent.stdev}`, sub: t.mostConsistent.name },
    t.bestCard && { label: 'BEST CARD', value: t.bestCard.tot.toFixed(1), sub: `${t.bestCard.name} · wk ${t.bestCard.week}` },
  ].filter(Boolean);
  const positions = t.teamPositions.filter((p) => p.value != null);

  return (
    <div style={{ border: `1px solid ${P.hair}`, background: P.navy, padding: '24px 22px', marginBottom: 20, position: 'relative' }}>
      <Brackets size={18} opacity={0.4} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline', marginBottom: 18 }}>
        <div style={{ fontFamily: HEAD, fontSize: 20, color: P.cream, letterSpacing: '0.08em' }}>SEASON AT A GLANCE</div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: P.mute, letterSpacing: '0.12em' }}>
          {meta.league} · {meta.squad} · {meta.window}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: positions.length ? 20 : 0 }}>
        {cards.map((c) => <Stat key={c.label} label={c.label} value={c.value} sub={c.sub} />)}
      </div>

      {positions.length > 0 && (
        <div>
          <div style={{ fontFamily: MONO, fontSize: 8, color: P.gold, letterSpacing: '0.22em', opacity: 0.7, marginBottom: 10 }}>
            TEAM POSITION PROFILE — POOLED ACROSS ALL {t.matchesFired} CARDS
          </div>
          {positions.map((p) => (
            <PositionBar key={p.key} label={p.label} value={p.value} teamValue={p.value}
              best={p.key === t.teamPosBest?.key} worst={p.key === t.teamPosWorst?.key} />
          ))}
          {t.teamPosBest && t.teamPosWorst && t.bestCard && (
            <p style={{ fontFamily: BODY, fontSize: 12, color: P.mute, lineHeight: 1.7, marginTop: 12 }}>
              The squad is strongest in {t.teamPosBest.label.toLowerCase()} ({t.teamPosBest.value}) and gives back the most in{' '}
              {t.teamPosWorst.label.toLowerCase()} ({t.teamPosWorst.value}).{' '}
              {t.ironman.length > 0 ? `${t.ironman.map((s) => s.name).join(' and ')} ${meta.complete ? 'fired' : 'have fired'} all ${meta.matches} matches. ` : ''}
              {t.mostImproved ? `${t.mostImproved.name} is ${t.mostImproved.delta >= 0 ? 'up' : 'down'} ${Math.abs(t.mostImproved.delta)} points from first card to last. ` : ''}
              {t.bestCard.name}'s {t.bestCard.tot.toFixed(1)} in week {t.bestCard.week} is the season high
              {t.worstCard && t.worstCard !== t.bestCard ? `; ${t.worstCard.name}'s ${t.worstCard.tot.toFixed(1)} in week ${t.worstCard.week} the low.` : '.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SeasonPicker({ seasons, value, onChange }) {
  if (seasons.length < 2) return null;
  return (
    <div role="tablist" aria-label="Season" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
      {seasons.map((sy) => {
        const on = sy === value;
        return (
          <button key={sy} role="tab" aria-selected={on} onClick={() => onChange(sy)}
            style={{
              background: on ? 'rgba(201,169,97,0.14)' : 'transparent', border: `1px solid ${on ? P.gold : P.hair}`,
              color: on ? P.bright : P.mute, fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em',
              padding: '7px 14px', cursor: 'pointer',
            }}>
            {seasonLabel(sy)}{sy === currentSchoolYear() ? ' · CURRENT' : ''}
          </button>
        );
      })}
    </div>
  );
}

// ── Export ───────────────────────────────────────────────────────────────────

export default function RifleAnalysis() {
  const { loading, seasons, build, offline } = useRifleSeasons();
  const [picked, setPicked] = useState(null);
  const season = picked && seasons.includes(picked) ? picked : seasons[0];
  const data = useMemo(() => (build && season ? build(season) : null), [build, season]);

  if (loading || !data) {
    return <div style={{ fontFamily: MONO, fontSize: 10, color: P.faint, letterSpacing: '0.2em', padding: '40px 0' }}>LOADING SEASON DATA…</div>;
  }
  return <SeasonView key={data.meta.season} data={data} seasons={seasons} season={season} onSeason={setPicked} offline={offline} />;
}

function SeasonView({ data, seasons, season, onSeason, offline }) {
  const { meta, team, shooters, latest } = data;
  const ranked = team.ranked;
  const ordered = [...ranked, ...shooters.filter((s) => s.dns)];

  const [expanded, setExpanded] = useState(() => new Set([ranked[0]?.name].filter(Boolean)));
  const allOpen = ordered.length > 0 && expanded.size >= ordered.length;
  const rowRefs = useRef({});

  const toggle = (name) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const toggleAll = () =>
    setExpanded(allOpen ? new Set() : new Set(ordered.map((s) => s.name)));

  const jumpTo = (name) => {
    setExpanded((prev) => new Set(prev).add(name));
    requestAnimationFrame(() => {
      rowRefs.current[name]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: P.gold, letterSpacing: '0.3em', opacity: 0.7 }}>
              {meta.complete ? '// COMPETITION · RETROSPECTIVE' : '// COMPETITION · LIVE SEASON'}
            </div>
            <div style={{ flex: 1, height: 1, background: P.hair, minWidth: 40 }} />
          </div>
          <h2 style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 42, color: P.cream, letterSpacing: '0.04em', margin: 0, lineHeight: 1 }}>
            SHOOTER ANALYSIS
          </h2>
          <p style={{ fontFamily: BODY, fontSize: 13, color: P.mute, margin: '10px 0 0', lineHeight: 1.6, maxWidth: 560 }}>
            Every cadet on the {meta.league} roster, broken down match by match — trajectory, position profile,
            consistency, and bull's-eye output from {meta.complete ? 'all' : 'the'} {meta.matches} match{meta.matches === 1 ? '' : 'es'}{meta.complete ? '' : ' shot so far'}.
          </p>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0, paddingBottom: 4 }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: P.gold, letterSpacing: '0.25em', opacity: 0.6, marginBottom: 6 }}>
            {seasonLabel(meta.season)} · {meta.complete ? 'COMPLETE' : `${meta.matches} MATCH${meta.matches === 1 ? '' : 'ES'} SHOT`}
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${P.hairStrong}`, padding: '8px 16px', background: P.deep }}>
            <span className={meta.complete ? undefined : 'rf-live-dot'} style={{ width: 7, height: 7, background: meta.complete ? P.gold : P.win, borderRadius: '50%' }} />
            <span style={{ fontFamily: HEAD, fontSize: 17, color: P.cream, letterSpacing: '0.14em' }}>{meta.complete ? 'SEASON ARCHIVED' : 'SEASON IN PROGRESS'}</span>
          </div>
        </div>
      </div>

      <SeasonPicker seasons={seasons} value={season} onChange={onSeason} />
      {offline && (
        <div style={{ fontFamily: MONO, fontSize: 9, color: P.faint, letterSpacing: '0.14em', marginBottom: 12 }}>
          SHOWING THE ARCHIVED 2025–26 SEASON — LIVE SCORES COULDN&apos;T LOAD.
        </div>
      )}

      <LatestComp match={latest} meta={meta} />
      <TeamOverview team={team} meta={meta} />

      <div style={{ fontFamily: MONO, fontSize: 8, color: P.faint, letterSpacing: '0.2em', marginBottom: 8 }}>
        QUICK LOOK · TAP A ROW TO JUMP TO FULL DOSSIER
      </div>
      <QuickTable ordered={ordered} onJump={jumpTo} meta={meta} />

      {/* Roster controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontFamily: MONO, fontSize: 8, color: P.faint, letterSpacing: '0.2em' }}>
          RANKED BY SEASON AGGREGATE AVERAGE
        </div>
        <button
          onClick={toggleAll}
          style={{
            background: 'none', border: `1px solid ${P.hair}`, color: P.gold, cursor: 'pointer',
            padding: '6px 14px', fontFamily: MONO, fontSize: 9, letterSpacing: '0.16em',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = P.gold)}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = P.hair)}
        >
          {allOpen ? 'COLLAPSE ALL' : 'EXPAND ALL'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ordered.map((s, i) => (
          <div key={s.name} ref={(el) => { rowRefs.current[s.name] = el; }} style={{ scrollMarginTop: 90 }}>
            <ShooterDossier
              shooter={s}
              rank={s.dns ? null : i + 1}
              expanded={expanded.has(s.name)}
              onToggle={() => toggle(s.name)}
              team={team}
              meta={meta}
            />
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          ['EXPERT · 245+', TIER_COLOR.Expert],
          ['SHARPSHOOTER · 220–244', TIER_COLOR.Sharpshooter],
          ['MARKSMAN · 200–219', TIER_COLOR.Marksman],
          ['NOT QUALIFIED · 0–199', TIER_COLOR['Not Qualified']],
        ].map(([label, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, background: color, opacity: 0.85 }} />
            <div style={{ fontFamily: MONO, fontSize: 8, color: P.mute, letterSpacing: '0.16em' }}>{label}</div>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 8, color: P.faint, letterSpacing: '0.14em' }}>
          PRONE / STANDING / KNEELING · ~100 PER POSITION
        </div>
      </div>
    </div>
  );
}
