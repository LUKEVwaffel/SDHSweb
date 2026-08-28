import { useMemo, useState } from 'react';
import { SEASON_META, SHOOTERS, TEAM, buildNarrative } from './rifleData';

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

// Sparkline domain — season low card was 142.6, high 257.2.
const Y_MIN = 130;
const Y_MAX = 265;

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
  const padL = 34;
  const padR = 10;
  const padT = 12;
  const padB = 20;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const x = (wk) => padL + ((wk - 1) / 9) * innerW;
  const y = (v) => padT + innerH - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * innerH;

  const pts = weeks.filter((w) => w.fired).map((w) => ({ wk: w.week, v: w.tot, b: w.b }));

  // Break the polyline into contiguous runs so byes render as gaps.
  const runs = [];
  let run = [];
  weeks.forEach((w) => {
    if (w.fired) {
      run.push({ wk: w.week, v: w.tot });
    } else if (run.length) {
      runs.push(run);
      run = [];
    }
  });
  if (run.length) runs.push(run);

  const gridVals = [150, 180, 210, 240];

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
      <line x1={padL} y1={y(teamAvg)} x2={width - padR} y2={y(teamAvg)} stroke={P.cream} strokeWidth="0.75" opacity="0.3" />

      {runs.map((r, i) => (
        <polyline
          key={i}
          points={r.map((p) => `${x(p.wk)},${y(p.v)}`).join(' ')}
          fill="none" stroke={P.bright} strokeWidth="1.6"
        />
      ))}

      {pts.map((p) => (
        <g key={p.wk}>
          <circle cx={x(p.wk)} cy={y(p.v)} r={p.b >= 4 ? 3.6 : 2.6}
            fill={p.b >= 4 ? P.bright : P.deep} stroke={P.bright} strokeWidth="1.4" />
          <text x={x(p.wk)} y={height - 6} fill={P.faint} fontFamily={MONO} fontSize="8" textAnchor="middle">
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
              <tr key={w.week} style={{ background: w.fired ? 'transparent' : 'rgba(244,236,216,0.02)' }}>
                <td style={cell('left')}>{String(w.week).padStart(2, '0')}</td>
                <td style={{ ...cell('left'), color: P.faint }}>{w.dates}</td>
                <td style={{ ...cell('left'), color: P.mute }}>{w.opp || '—'}</td>
                {w.fired ? (
                  <>
                    <td style={cell('right')}>{w.p.toFixed(1)}</td>
                    <td style={cell('right')}>{w.s.toFixed(1)}</td>
                    <td style={cell('right')}>{w.k.toFixed(1)}</td>
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

// ── Shooter dossier ──────────────────────────────────────────────────────────

function ShooterDossier({ shooter, rank, expanded, onToggle }) {
  const s = shooter;
  const narrative = useMemo(() => buildNarrative(s, TEAM), [s]);
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
            <span style={{ fontFamily: MONO, fontSize: 8, color: P.faint, letterSpacing: '0.16em' }}>
              RIFLE {String(s.rifle).padStart(2, '0')}
            </span>
            <ClassChip tier={s.classification.tier} range={s.classification.range} small />
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: P.mute, letterSpacing: '0.1em', marginTop: 5 }}>
            {s.dns
              ? 'NO CARD ON FILE · 0 / 10 MATCHES'
              : `${s.avg} AVG · BEST ${s.best} (WK ${s.bestWeek}) · ${s.firedCount} / ${SEASON_META.matches} MATCHES · ${s.trend >= 0 ? '+' : ''}${s.trend} PTS/MATCH`}
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
                <Sparkline weeks={s.weeks} avg={s.avg} teamAvg={TEAM.teamAvg} />
              </div>

              {/* Stat grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 18 }}>
                <Stat label="SEASON AVG" value={s.avg} sub={`of ~300`} />
                <Stat label="BEST CARD" value={s.best} sub={`week ${s.bestWeek}`} tone="up" />
                <Stat label="LOW CARD" value={s.worst} sub={`week ${s.worstWeek}`} tone="down" />
                <Stat label="1ST → LAST" value={`${s.delta >= 0 ? '+' : ''}${s.delta}`} sub={`${s.first} → ${s.last}`} tone={s.delta >= 0 ? 'up' : 'down'} />
                <Stat label="TREND" value={`${s.trend >= 0 ? '+' : ''}${s.trend}`} sub="pts / match" tone={s.trend >= 0 ? 'up' : 'down'} />
                <Stat label="CONSISTENCY" value={`±${s.stdev}`} sub="match-to-match" />
                <Stat label="SPREAD" value={s.range} sub={`best − low`} />
                <Stat label="BULL'S-EYES" value={s.bulls} sub={`${s.bullsPerMatch} / match`} />
              </div>

              {/* Position breakdown */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: P.gold, letterSpacing: '0.22em', opacity: 0.7, marginBottom: 10 }}>
                  POSITION AVERAGES · WHITE TICK = TEAM AVERAGE
                </div>
                {s.positions.map((p, i) => (
                  <PositionBar
                    key={p.key}
                    label={p.label}
                    value={p.value}
                    teamValue={TEAM.teamPositions[i].value}
                    best={p.key === s.posBest.key}
                    worst={p.key === s.posWorst.key}
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

// ── Team overview ────────────────────────────────────────────────────────────

function TeamOverview() {
  const t = TEAM;
  const cards = [
    { label: 'ROSTER', value: t.rosterCount, sub: `${t.activeCount} fired · ${t.dnsCount} DNS` },
    { label: 'MATCHES FIRED', value: t.matchesFired, sub: `across ${SEASON_META.matches} weeks` },
    { label: 'TEAM MATCH AVG', value: t.teamAvg, sub: 'all cards pooled' },
    { label: "BULL'S-EYES", value: t.totalBulls, sub: 'team total' },
    { label: 'TOP AVERAGE', value: t.topShooter.avg, sub: t.topShooter.name },
    { label: 'MOST IMPROVED', value: `+${t.mostImproved.delta}`, sub: `${t.mostImproved.name} · 1st→last` },
    { label: 'MOST CONSISTENT', value: `±${t.mostConsistent.stdev}`, sub: t.mostConsistent.name },
    { label: 'BEST CARD', value: t.bestCard.tot.toFixed(1), sub: `${t.bestCard.name} · wk ${t.bestCard.week}` },
  ];

  return (
    <div style={{ border: `1px solid ${P.hair}`, background: P.navy, padding: '24px 22px', marginBottom: 20, position: 'relative' }}>
      <Brackets size={18} opacity={0.4} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline', marginBottom: 18 }}>
        <div style={{ fontFamily: HEAD, fontSize: 20, color: P.cream, letterSpacing: '0.08em' }}>SEASON AT A GLANCE</div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: P.mute, letterSpacing: '0.12em' }}>
          {SEASON_META.league} · {SEASON_META.squad} · {SEASON_META.window}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 20 }}>
        {cards.map((c) => (
          <Stat key={c.label} label={c.label} value={c.value} sub={c.sub} />
        ))}
      </div>

      {/* Team position profile */}
      <div>
        <div style={{ fontFamily: MONO, fontSize: 8, color: P.gold, letterSpacing: '0.22em', opacity: 0.7, marginBottom: 10 }}>
          TEAM POSITION PROFILE — POOLED ACROSS ALL {t.matchesFired} CARDS
        </div>
        {t.teamPositions.map((p) => (
          <PositionBar
            key={p.key}
            label={p.label}
            value={p.value}
            teamValue={p.value}
            best={p.key === t.teamPosBest.key}
            worst={p.key === t.teamPosWorst.key}
          />
        ))}
        <p style={{ fontFamily: BODY, fontSize: 12, color: P.mute, lineHeight: 1.7, marginTop: 12 }}>
          The squad is carried by prone ({t.teamPosBest.value}) and gives back the most in {t.teamPosWorst.label.toLowerCase()}
          {' '}({t.teamPosWorst.value}) — the standard new-shooter profile.{' '}
          {t.ironman.length > 0
            ? `${t.ironman.map((s) => s.name).join(' and ')} fired all ${SEASON_META.matches} matches. `
            : ''}
          {t.mostImproved.name} added {t.mostImproved.delta} points from first card to last; {t.worstCard.name}'s {t.worstCard.tot.toFixed(1)} in
          {' '}week {t.worstCard.week} was the season's low card, and {t.bestCard.name}'s {t.bestCard.tot.toFixed(1)} in week {t.bestCard.week} was the high.
        </p>
      </div>
    </div>
  );
}

// ── Export ───────────────────────────────────────────────────────────────────

export default function RifleAnalysis() {
  const ranked = TEAM.ranked;
  const dnsShooters = SHOOTERS.filter((s) => s.dns);
  const ordered = [...ranked, ...dnsShooters];

  const [expanded, setExpanded] = useState(() => new Set([ranked[0]?.name]));
  const allOpen = expanded.size >= ordered.length;

  const toggle = (name) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const toggleAll = () =>
    setExpanded(allOpen ? new Set() : new Set(ordered.map((s) => s.name)));

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: P.gold, letterSpacing: '0.3em', opacity: 0.7 }}>
              // COMPETITION · RETROSPECTIVE
            </div>
            <div style={{ flex: 1, height: 1, background: P.hair, minWidth: 40 }} />
          </div>
          <h2 style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 42, color: P.cream, letterSpacing: '0.04em', margin: 0, lineHeight: 1 }}>
            SHOOTER ANALYSIS
          </h2>
          <p style={{ fontFamily: BODY, fontSize: 13, color: P.mute, margin: '10px 0 0', lineHeight: 1.6, maxWidth: 560 }}>
            Every cadet on the {SEASON_META.league} roster, broken down match by match —
            trajectory, position profile, consistency, and bull's-eye output from all {SEASON_META.matches} postal matches.
          </p>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0, paddingBottom: 4 }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: P.gold, letterSpacing: '0.25em', opacity: 0.6, marginBottom: 6 }}>
            2025–26 · COMPLETE
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${P.hairStrong}`, padding: '8px 16px', background: P.deep }}>
            <span style={{ width: 7, height: 7, background: P.gold, borderRadius: '50%' }} />
            <span style={{ fontFamily: HEAD, fontSize: 17, color: P.cream, letterSpacing: '0.14em' }}>SEASON ARCHIVED</span>
          </div>
        </div>
      </div>

      <TeamOverview />

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
          <ShooterDossier
            key={s.name}
            shooter={s}
            rank={s.dns ? null : i + 1}
            expanded={expanded.has(s.name)}
            onToggle={() => toggle(s.name)}
          />
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
