import { useMemo } from 'react';
import { P, mono, oswald, fraunces } from '../admin/theme.js';
import { SEASON } from '../RaiderCompetitionResults.jsx';

// Interstitial shown between every film on /videotv. Leads with the State
// Conference standing (the season's headline), then every podium this season
// flattened out of RaiderCompetitionResults' SEASON so it can't drift from
// what /raiders shows. Newest meet is flagged LATEST.

const placeRank = (p) => {
  const n = parseInt(p, 10);
  return Number.isNaN(n) ? 999 : n;
};

function trophiesForMeet(meet) {
  const podium = /^(1st|2nd|3rd)$/i;
  const teams = meet.teams
    .filter((t) => placeRank(t.place) <= 3)
    .map((t) => ({ label: `${t.team} Team · Overall`, place: t.place }));
  const events = meet.events
    .map((ev) => ({ label: ev.name, place: podium.test(ev.result) ? ev.result : podium.test(ev.note || '') ? ev.note : null }))
    .filter((ev) => ev.place);
  return [...teams, ...events];
}

function medalFor(place) {
  const n = placeRank(place);
  return n === 1 ? '🥇' : n === 2 ? '🥈' : n === 3 ? '🥉' : null;
}

export default function VideoTvTrophySlide({ upNext }) {
  const meets = useMemo(
    () => SEASON.meets.map((m) => ({ meet: m, trophies: trophiesForMeet(m) })).filter((m) => m.trophies.length > 0),
    [],
  );
  const total = meets.reduce((n, m) => n + m.trophies.length, 0);
  const conf = SEASON.conference;

  return (
    <div className="vtv-fade" style={wrap}>
      {conf && (
        <div style={hero}>
          <div style={heroKicker}>◆ {SEASON.label} ◆</div>
          <div style={heroPlace}>{conf.place}</div>
          <div style={heroLabel}>{conf.label} · {conf.scope}</div>
          <div style={heroSub}>Trojan Battalion Raider Team</div>
        </div>
      )}

      <div style={caseWrap}>
        <div style={caseHead}>
          <span style={caseTitle}>Trophy Case</span>
          <span style={caseCount}>{total} podium finishes · {meets.length} meets</span>
        </div>
        <div style={grid}>
          {meets.map(({ meet, trophies }, i) => (
            <div key={meet.name} style={{ ...col, ...(i === 0 ? colLatest : null) }}>
              <div style={colHead}>
                {i === 0 && <div style={latestTag}>LATEST</div>}
                <div style={meetName}>{meet.name.replace(/ Raider Competition$/, '')}</div>
                <div style={meetMeta}>{meet.date.toUpperCase()} · {meet.location.toUpperCase()}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {trophies.map((t) => (
                  <div key={`${t.label}-${t.place}`} style={chip}>
                    <span style={{ fontSize: 'clamp(14px,1.3vw,22px)' }}>{medalFor(t.place)}</span>
                    <span style={chipLabel}>{t.label}</span>
                    <span style={chipPlace}>{t.place}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {upNext && <div style={next}>UP NEXT · <span style={{ color: P.cream }}>{upNext}</span></div>}
      </div>
    </div>
  );
}

// ── styles ──────────────────────────────────────────────────────────────────
const wrap = {
  width: '100%', height: '100%', boxSizing: 'border-box', padding: '3vh 4vw',
  display: 'grid', gridTemplateColumns: 'minmax(0,0.9fr) minmax(0,1.6fr)', gap: '3vw', alignItems: 'center',
  background: 'radial-gradient(ellipse at 20% 50%, rgba(201,169,97,0.16), transparent 60%)',
};
const hero = { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' };
const heroKicker = { fontFamily: mono, fontSize: 'clamp(11px,1.1vw,16px)', color: P.gold, letterSpacing: '0.32em' };
const heroPlace = {
  fontFamily: fraunces, fontStyle: 'italic', fontWeight: 900, color: P.bright,
  fontSize: 'clamp(120px,19vw,340px)', lineHeight: 0.85, margin: '1vh 0 0',
  textShadow: '0 0 60px rgba(201,169,97,0.35)',
};
const heroLabel = {
  fontFamily: oswald, fontWeight: 700, color: P.cream, textTransform: 'uppercase',
  fontSize: 'clamp(26px,3.6vw,60px)', letterSpacing: '0.04em', lineHeight: 1.05, marginTop: '1.5vh',
};
const heroSub = { fontFamily: mono, fontSize: 'clamp(11px,1vw,15px)', color: P.mute, letterSpacing: '0.18em', marginTop: '1.5vh', textTransform: 'uppercase' };
const caseWrap = { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.6vh', maxHeight: '100%', overflow: 'hidden' };
const caseHead = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, borderBottom: `1px solid ${P.hairStrong}`, paddingBottom: '1vh' };
const caseTitle = { fontFamily: oswald, fontWeight: 700, color: P.cream, fontSize: 'clamp(18px,2vw,32px)', letterSpacing: '0.06em', textTransform: 'uppercase' };
const caseCount = { fontFamily: mono, fontSize: 'clamp(10px,0.95vw,14px)', color: P.gold, letterSpacing: '0.12em' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '1.2vw' };
const col = { border: `1px solid ${P.hair}`, background: 'rgba(10,22,40,0.6)', padding: '1.4vh 1vw' };
const colLatest = { border: `1px solid ${P.gold}`, background: 'rgba(201,169,97,0.1)' };
const colHead = { marginBottom: '1vh' };
const latestTag = { display: 'inline-block', fontFamily: mono, fontSize: 'clamp(9px,0.8vw,12px)', letterSpacing: '0.2em', color: P.ink, background: P.gold, padding: '2px 8px', marginBottom: 6 };
const meetName = { fontFamily: oswald, fontWeight: 600, color: P.bright, fontSize: 'clamp(14px,1.4vw,22px)' };
const meetMeta = { fontFamily: mono, fontSize: 'clamp(9px,0.75vw,12px)', color: P.mute, letterSpacing: '0.1em', marginTop: 3 };
const chip = { display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${P.hair}`, background: P.goldWash, padding: '0.45vh 0.8vw' };
const chipLabel = { flex: 1, minWidth: 0, fontFamily: oswald, fontSize: 'clamp(11px,1vw,17px)', color: P.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const chipPlace = { flexShrink: 0, fontFamily: mono, fontWeight: 700, fontSize: 'clamp(10px,0.9vw,14px)', color: P.gold, letterSpacing: '0.08em' };
const next = { fontFamily: mono, fontSize: 'clamp(11px,1vw,15px)', color: P.gold, letterSpacing: '0.2em', textTransform: 'uppercase' };
