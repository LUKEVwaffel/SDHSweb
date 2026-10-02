import { SEASON } from '../RaiderCompetitionResults';
import { SEASON as SEASON_YEAR } from './OpticFinale';

// ── The season's trophy case, one shelf per meet (oldest at the top, like a
// real case filled over a season). Built straight from SEASON in
// RaiderCompetitionResults.jsx, so logging a meet there also stocks the case:
// every division standing in `teams[]` and every podium in `events[]` is one
// trophy. Plays as an act in OpticShow.

const TIER = { '1st': 1, '2nd': 2, '3rd': 3 };
const TIER_NAME = { 1: 'gold', 2: 'silver', 3: 'bronze' };
const SHELF_STAGGER_MS = 420;
const TROPHY_STAGGER_MS = 110;
const CASE_LEAD_MS = 1300; // after the case itself has faded in

const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace('Co-ed', 'Co-Ed');

/** @returns {{ meet: string, date: string, trophies: object[] }[]} */
export function seasonShelves() {
  return [...SEASON.meets].reverse().map((m) => {
    const division = m.teams
      .filter((t) => TIER[t.place])
      .map((t) => ({ place: t.place, event: 'Overall Division', team: titleCase(t.team), big: true }));
    const events = m.events
      .map((e) => {
        const place = TIER[e.note] ? e.note : e.result;
        const [event, team = ''] = e.name.split(' · ');
        return { place, event: event.replace(/\s*\(.*\)$/, ''), team, big: false };
      })
      .filter((t) => TIER[t.place]);
    const trophies = [...division, ...events].sort((a, b) => TIER[a.place] - TIER[b.place] || Number(b.big) - Number(a.big));
    return { meet: m.name.replace(/\s*Raider Competition$/i, ''), date: m.date, trophies };
  }).filter((s) => s.trophies.length);
}

function Cup({ tier, big }) {
  const fill = `url(#tc-${TIER_NAME[tier]})`;
  return (
    <svg className="tc-cup" data-big={big} viewBox="0 0 80 110" aria-hidden="true">
      <path d="M22 10 H58 V34 C58 48 50 58 40 58 C30 58 22 48 22 34 Z" fill={fill} />
      <path d="M22 16 C10 16 8 34 22 40" fill="none" stroke={fill} strokeWidth="5" strokeLinecap="round" />
      <path d="M58 16 C70 16 72 34 58 40" fill="none" stroke={fill} strokeWidth="5" strokeLinecap="round" />
      <rect x="36" y="57" width="8" height="18" fill={fill} />
      <rect x="27" y="74" width="26" height="7" rx="2" fill={fill} />
      <rect x="20" y="81" width="40" height="22" rx="2" fill="#2A1A0E" />
      <rect x="25" y="86" width="30" height="12" rx="1" fill={fill} opacity="0.85" />
      <text x="40" y="95.5" textAnchor="middle" fill="#1A1206"
        style={{ font: '700 8px Oswald, sans-serif' }}>{['', '1ST', '2ND', '3RD'][tier]}</text>
      <path d="M28 14 C28 30 31 42 36 50" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Gradients() {
  const stops = {
    gold: ['#FFF0BE', '#E8C77A', '#B58E3C', '#7C5E22'],
    silver: ['#FFFFFF', '#D5DAE2', '#9AA3B0', '#636B78'],
    bronze: ['#F6CFA4', '#C98B55', '#93582C', '#5E3618'],
  };
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {Object.entries(stops).map(([k, c]) => (
          <linearGradient key={k} id={`tc-${k}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={c[0]} />
            <stop offset="0.35" stopColor={c[1]} />
            <stop offset="0.7" stopColor={c[2]} />
            <stop offset="1" stopColor={c[3]} />
          </linearGradient>
        ))}
      </defs>
    </svg>
  );
}

export function TrophyCase() {
  const shelves = seasonShelves();
  const all = shelves.flatMap((s) => s.trophies);
  const firsts = all.filter((t) => t.place === '1st').length;
  let n = 0;

  return (
    <section className="act act-trophies">
      <Gradients />
      <div className="act-kick">THE {SEASON_YEAR} TROPHY CASE</div>
      <h1 className="act-h">{all.length} <span className="accent">trophies.</span></h1>
      <div className="tc-tally">
        <span><b>{shelves.length}</b> MEETS</span>
        <span><b>{firsts}</b> FIRST PLACE</span>
        <span><b>3RD</b> IN STATE</span>
      </div>

      <div className="tc-case">
        <div className="tc-glass" aria-hidden="true" />
        {shelves.map((s, si) => (
          <div className="tc-shelf" key={s.meet}>
            <div className="tc-row" role="list" aria-label={`${s.meet} trophies`}>
              {s.trophies.map((t) => {
                const delay = CASE_LEAD_MS + si * SHELF_STAGGER_MS + n * TROPHY_STAGGER_MS;
                n += 1;
                return (
                  <div
                    className="tc-trophy"
                    role="listitem"
                    key={`${t.event}-${t.team}-${t.place}`}
                    data-tier={TIER[t.place]}
                    style={{ animationDelay: `${delay}ms` }}
                    aria-label={`${t.place} place, ${t.event}${t.team ? `, ${t.team}` : ''}`}
                  >
                    <Cup tier={TIER[t.place]} big={t.big} />
                    <div className="tc-plaque">
                      <b>{t.event}</b>
                      {t.team && <i>{t.team}</i>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="tc-board" aria-hidden="true" />
            <div className="tc-label">
              <b>{s.meet.toUpperCase()}</b>
              <span>{s.date}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** ms until the last trophy has landed, for pacing the NEXT button. */
export function trophyCaseDuration() {
  const shelves = seasonShelves();
  const count = shelves.reduce((a, s) => a + s.trophies.length, 0);
  return CASE_LEAD_MS + (shelves.length - 1) * SHELF_STAGGER_MS + count * TROPHY_STAGGER_MS + 600;
}
