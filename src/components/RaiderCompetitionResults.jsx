import { useState } from 'react';

// ── COMPETITION RESULTS ──────────────────────────────────────────────────────
// The season's full competitive record: headline stats, per-meet placements by
// team, and event-by-event splits. Static content — no results table exists in
// the DB yet. Update SEASON below after each meet; the UI derives every number
// on this page from it, so keep the shapes intact:
//   summary  → optional manual override tiles (auto-computed if omitted)
//   meets[]  → { name, date, location, teams[], events[] }
//     teams[]  → { team, place (e.g. '1st' | '4th' | 'DNF'), of (field size) }
//     events[] → { name, result, note? }

const SEASON = {
  label: '2025–26 SEASON',
  // Add one object per meet as results come in:
  //   {
  //     name: 'Rhea County Raider Challenge',
  //     date: 'Sep 13, 2025',
  //     location: 'Evensville, TN',
  //     teams: [{ team: 'MALE', place: '1st', of: 14 }, ...],   // place: '1st' | 'DNF' etc.
  //     events: [{ name: 'One-Rope Bridge', result: '3:42', note: '1st' }, ...],
  //   }
  meets: [],
};

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)',
  hairStrong: 'rgba(201,169,97,0.5)', green: '#7EC87E',
};
const mono = "'JetBrains Mono', monospace";
const oswald = 'Oswald, sans-serif';

const placeRank = (p) => {
  const n = parseInt(p, 10);
  return Number.isNaN(n) ? 999 : n;
};

function Brackets({ size = 14, opacity = 0.4 }) {
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

// Auto-derived headline numbers so the tiles can't drift from the meet log.
function computeSummary(meets) {
  const allPlaces = meets.flatMap((m) => m.teams.map((t) => placeRank(t.place)));
  const podiums = allPlaces.filter((n) => n >= 1 && n <= 3).length;
  const wins = allPlaces.filter((n) => n === 1).length;
  const best = Math.min(...allPlaces.filter((n) => n < 999), 999);
  const bestMeet = meets.find((m) => m.teams.some((t) => placeRank(t.place) === best));
  const bestTeam = bestMeet?.teams.find((t) => placeRank(t.place) === best);
  return [
    { label: 'MEETS', value: String(meets.length) },
    { label: 'PODIUM FINISHES', value: String(podiums), sub: 'top-3 team results' },
    { label: 'FIRST-PLACE FINISHES', value: String(wins) },
    {
      label: 'BEST FINISH',
      value: best === 999 ? '—' : `${best}${['st', 'nd', 'rd'][best - 1] || 'th'}`,
      sub: bestTeam ? `${bestTeam.team} · ${bestMeet.name.split(' ').slice(0, 2).join(' ')}` : undefined,
    },
  ];
}

function PlaceBadge({ place, of }) {
  const rank = placeRank(place);
  const podium = rank >= 1 && rank <= 3;
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'baseline', gap: 8,
      border: `1px solid ${podium ? P.gold : P.hair}`,
      background: podium ? 'rgba(201,169,97,0.1)' : 'transparent',
      padding: '6px 12px',
    }}>
      {medal && <span aria-hidden="true" style={{ fontSize: 13 }}>{medal}</span>}
      <span style={{ fontFamily: oswald, fontWeight: 700, fontSize: 20, color: podium ? P.bright : P.cream, lineHeight: 1 }}>
        {place}
      </span>
      {of != null && <span style={{ fontFamily: mono, fontSize: 9, color: P.mute }}>of {of}</span>}
    </div>
  );
}

function MeetCard({ meet, open, onToggle }) {
  const topTeam = [...meet.teams].sort((a, b) => placeRank(a.place) - placeRank(b.place))[0];
  return (
    <div style={{ border: `1px solid ${open ? P.hairStrong : P.hair}`, background: P.deep, position: 'relative', transition: 'border-color 0.2s' }}>
      <Brackets size={16} opacity={open ? 0.6 : 0.28} />
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
          padding: '22px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, justifyContent: 'space-between',
        }}
      >
        <div style={{ minWidth: 220 }}>
          <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.2em', opacity: 0.7, marginBottom: 6 }}>
            {meet.date.toUpperCase()} · {meet.location.toUpperCase()}
          </div>
          <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 24, color: P.cream, letterSpacing: '0.02em', lineHeight: 1.15 }}>
            {meet.name}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: mono, fontSize: 8, color: P.mute, letterSpacing: '0.2em', marginBottom: 4 }}>TOP TEAM</div>
            <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 16, color: P.gold }}>
              {topTeam.team} · {topTeam.place}
            </div>
          </div>
          <span style={{ fontFamily: mono, fontSize: 14, color: P.gold, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</span>
        </div>
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${P.hair}`, padding: '20px 24px', display: 'grid', gap: 22 }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 8, color: P.gold, letterSpacing: '0.28em', opacity: 0.7, marginBottom: 12 }}>
              TEAM PLACEMENTS
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {meet.teams.map((t) => (
                <div key={t.team} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontFamily: mono, fontSize: 10, color: P.cream, letterSpacing: '0.16em' }}>{t.team}</span>
                  <PlaceBadge place={t.place} of={t.of} />
                </div>
              ))}
            </div>
          </div>

          {meet.events?.length > 0 && (
            <div>
              <div style={{ fontFamily: mono, fontSize: 8, color: P.gold, letterSpacing: '0.28em', opacity: 0.7, marginBottom: 12 }}>
                EVENT SPLITS
              </div>
              <div style={{ display: 'grid', gap: 1, background: P.hair, border: `1px solid ${P.hair}` }}>
                {meet.events.map((ev) => (
                  <div key={ev.name} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    background: P.deep, padding: '10px 14px',
                  }}>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: P.cream }}>{ev.name}</span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      {ev.note && (
                        <span style={{ fontFamily: mono, fontSize: 8.5, color: P.green, letterSpacing: '0.1em' }}>{ev.note.toUpperCase()}</span>
                      )}
                      <span style={{ fontFamily: oswald, fontWeight: 700, fontSize: 17, color: P.gold, letterSpacing: '0.02em' }}>{ev.result}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RaiderCompetitionResults() {
  const meets = SEASON.meets;
  const summary = SEASON.summary || computeSummary(meets);
  const [openIdx, setOpenIdx] = useState(0);

  return (
    <div style={{
      border: `1px solid ${P.gold}`,
      background: `linear-gradient(165deg, rgba(201,169,97,0.07), rgba(6,16,31,0.4) 60%)`,
      padding: '52px 44px', position: 'relative', overflow: 'hidden',
    }}>
      <Brackets size={22} opacity={0.55} />

      {/* headline */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.4em', opacity: 0.8, marginBottom: 14 }}>
          // {SEASON.label}
        </div>
        <h2 style={{
          fontFamily: oswald, fontWeight: 700, fontSize: 64, color: P.cream,
          letterSpacing: '0.02em', margin: 0, lineHeight: 0.95,
        }}>
          COMPETITION<br />RESULTS
        </h2>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: P.mute, lineHeight: 1.7, margin: '16px 0 0', maxWidth: 620 }}>
          Every meet the battalion has run this season — team placements, field sizes, and event-by-event splits.
        </p>
      </div>

      {/* headline stat tiles */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 44,
      }}>
        {summary.map((s) => (
          <div key={s.label} style={{ border: `1px solid ${P.hairStrong}`, background: 'rgba(6,16,31,0.55)', padding: '22px 20px', position: 'relative' }}>
            <Brackets size={12} opacity={0.3} />
            <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 40, color: P.gold, lineHeight: 1, letterSpacing: '0.02em' }}>
              {s.value}
            </div>
            <div style={{ fontFamily: mono, fontSize: 9, color: P.cream, letterSpacing: '0.18em', marginTop: 12 }}>
              {s.label}
            </div>
            {s.sub && <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10.5, color: P.mute, marginTop: 6, lineHeight: 1.5 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* per-meet log */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.3em', opacity: 0.7 }}>// MEET LOG</div>
        <div style={{ flex: 1, height: 1, background: P.hair }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {meets.length > 0 ? (
          meets.map((m, i) => (
            <MeetCard key={m.name} meet={m} open={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? -1 : i)} />
          ))
        ) : (
          <div style={{ border: `1px solid ${P.hair}`, background: P.deep, padding: '40px 24px', textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute }}>
            No meets logged yet this season. Results post here after each competition.
          </div>
        )}
      </div>
    </div>
  );
}
