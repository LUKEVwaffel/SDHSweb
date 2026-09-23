import { useEffect, useMemo, useRef, useState } from 'react';
import { P, mono, oswald, fraunces } from '../admin/theme.js';
import { videoUrl } from '../../lib/raiderTv.js';
import { SEASON } from '../RaiderCompetitionResults.jsx';

// /videotv — hallway-TV loop for the East Hamilton OC run: plays both OC clips
// back-to-back (muted, no controls, no remote — read-only, same family as
// /balltv and /raidertv), then a Trophy Case slide showing every podium the
// battalion has won this season, then repeats forever.
//
// Self-contained full-screen anon route (App.jsx bypass), same pattern as
// /balltv and /watchzone.

// The two OC clips from raider_videos (same table /watchzone features from —
// see FEATURED_IDS there). storage_path is resolved against the public
// raider-videos bucket via videoUrl().
const OC_CLIPS = [
  { id: '86839e28-6160-42d0-9d49-46adca8c345a', title: 'OC — Part 1', storage_path: '1789831439000-part1-oc.mp4', duration_sec: 531.5 },
  { id: '3252c9a8-6e2f-4578-8649-70d184f0029e', title: 'OC — Part 2', storage_path: '1789831439001-part2-oc.mp4', duration_sec: 297.2 },
];

const WATCHING_LABEL = 'East Hamilton Raider Competition';
const WATCHING_LOCATION = 'East Hamilton, TN · Sep 19, 2026';
const WATCHING_EVENT = 'Hurricane Hill · Obstacle Course';
const WATCHING_TEAM = 'Trojan Battalion Raider Team — Male Squad';

const TROPHY_MS = 26000;      // trophy case dwell time
const TITLE_CARD_MS = 7000;   // "coaching corner" intermission dwell time
const VIDEO_FALLBACK_MS = 20000; // advance anyway if a clip never fires 'ended' (stalled load)

// Playback order: part 1 → intermission title card → part 2 → trophy case → repeat.
const STEPS = [
  { kind: 'video', clip: OC_CLIPS[0] },
  { kind: 'title' },
  { kind: 'video', clip: OC_CLIPS[1] },
  { kind: 'trophy' },
];

const placeRank = (p) => {
  const n = parseInt(p, 10);
  return Number.isNaN(n) ? 999 : n;
};

// Every podium finish across the whole season — team placements plus
// event-level podiums — flattened out of RaiderCompetitionResults' own data
// so this can't drift from what /raiders shows.
function trophiesForMeet(meet) {
  const items = [];
  meet.teams.forEach((t) => {
    if (placeRank(t.place) <= 3) items.push({ label: `${t.team} Team`, place: t.place });
  });
  meet.events.forEach((ev) => {
    const podiumMatch = /^(1st|2nd|3rd)$/i;
    const place = podiumMatch.test(ev.result) ? ev.result : podiumMatch.test(ev.note || '') ? ev.note : null;
    if (place) items.push({ label: ev.name, place });
  });
  return items;
}

function medalFor(place) {
  const n = placeRank(place);
  return n === 1 ? '🥇' : n === 2 ? '🥈' : n === 3 ? '🥉' : null;
}

export default function VideoTv() {
  const [step, setStep] = useState(0);
  const videoRef = useRef(null);
  const fallbackRef = useRef(null);

  const advance = () => setStep((s) => (s + 1) % STEPS.length);

  const current = STEPS[step];
  const isVideoStep = current.kind === 'video';
  const isTitleStep = current.kind === 'title';
  const clip = current.clip ?? null;

  useEffect(() => {
    if (!isVideoStep) return undefined;
    const v = videoRef.current;
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
    clearTimeout(fallbackRef.current);
    fallbackRef.current = setTimeout(advance, VIDEO_FALLBACK_MS + (clip?.duration_sec ? clip.duration_sec * 1000 : 0));
    return () => clearTimeout(fallbackRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (isVideoStep) return undefined;
    const id = setTimeout(advance, isTitleStep ? TITLE_CARD_MS : TROPHY_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const meetsWithTrophies = useMemo(
    () => SEASON.meets.map((m) => ({ meet: m, trophies: trophiesForMeet(m) })).filter((m) => m.trophies.length > 0),
    [],
  );
  const totalTrophies = useMemo(
    () => meetsWithTrophies.reduce((n, m) => n + m.trophies.length, 0),
    [meetsWithTrophies],
  );

  return (
    <div style={root}>
      {/* top bar — all overlay text lives here, never drawn over the picture itself */}
      <div style={topBar}>
        <div>
          <div style={infoKicker}>
            {isVideoStep ? 'NOW WATCHING' : isTitleStep ? 'COACHING CORNER' : 'SEASON RECORD'}
          </div>
          <div style={infoTitle}>
            {isVideoStep ? clip.title : isTitleStep ? 'Up Next: Part 2' : SEASON.label}
          </div>
        </div>
        <div style={topBarMeta}>
          {isVideoStep ? (
            <>
              <div style={infoRow}><span style={infoDot} />{WATCHING_EVENT}</div>
              <div style={infoRow}>{WATCHING_LABEL} · {WATCHING_LOCATION}</div>
              <div style={infoTeam}>{WATCHING_TEAM}</div>
            </>
          ) : isTitleStep ? (
            <div style={infoTeam}>A WORD FROM WILL BAKER</div>
          ) : (
            <div style={infoTeam}>{totalTrophies} podium finishes across {meetsWithTrophies.length} meets</div>
          )}
        </div>
      </div>

      <div style={stage}>
        {isVideoStep ? (
          <video
            key={clip.id}
            ref={videoRef}
            src={videoUrl(clip.storage_path)}
            muted
            autoPlay
            playsInline
            onEnded={advance}
            style={videoEl}
          />
        ) : isTitleStep ? (
          <div style={titleCardWrap}>
            <div style={titleCardRule} />
            <div style={titleCardKicker}>◆ TONIGHT'S TUTORIAL ◆</div>
            <div style={titleCardHeadline}>
              How to Get Up an<br />8&nbsp;Foot Wall
              <br /><span style={titleCardWrong}>(The Wrong Way)</span>
            </div>
            <div style={titleCardByline}>— with Will Baker —</div>
            <div style={titleCardRule} />
          </div>
        ) : (
          <div style={trophyGrid}>
            {meetsWithTrophies.map(({ meet, trophies }) => (
              <div key={meet.name} style={trophyCol}>
                <div style={trophyColHead}>
                  <div style={trophyMeetName}>{meet.name}</div>
                  <div style={trophyMeetMeta}>{meet.date.toUpperCase()} · {meet.location.toUpperCase()}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {trophies.map((t, i) => (
                    <div key={i} style={trophyChip}>
                      <span style={{ fontSize: 22 }}>{medalFor(t.place)}</span>
                      <div style={{ flex: 1 }}>
                        <div style={trophyChipLabel}>{t.label}</div>
                        <div style={trophyChipPlace}>{t.place}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* bottom bar — progress only, same solid-black treatment as the top */}
      <div style={bottomBar}>
        <div style={ticks}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ ...tick, ...(i === step ? tickActive : i < step ? tickDone : null) }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── styles ──────────────────────────────────────────────────────────────────
const root = {
  position: 'fixed', inset: 0, background: '#000',
  display: 'flex', flexDirection: 'column',
};
const topBar = {
  flexShrink: 0, background: '#000', borderBottom: `1px solid ${P.hairStrong}`,
  padding: 'clamp(16px,2.4vh,28px) clamp(20px,3vw,40px)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
  gap: '4vw', flexWrap: 'wrap',
};
const topBarMeta = { display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', textAlign: 'right' };
const stage = { flex: 1, minHeight: 0, position: 'relative', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const videoEl = { width: '100%', height: '100%', objectFit: 'contain', background: '#000', display: 'block' };
const infoKicker = {
  fontFamily: mono, fontSize: 'clamp(10px,1vw,14px)', color: P.gold,
  letterSpacing: '0.32em', textTransform: 'uppercase',
};
const infoTitle = {
  fontFamily: fraunces, fontStyle: 'italic', fontWeight: 700, color: P.cream,
  fontSize: 'clamp(18px,2.2vw,32px)', margin: '4px 0 0',
};
const infoRow = {
  display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end',
  fontFamily: oswald, fontSize: 'clamp(12px,1.15vw,17px)', color: P.mute,
};
const infoDot = { width: 6, height: 6, borderRadius: '50%', background: P.gold, display: 'inline-block' };
const infoTeam = {
  fontFamily: mono, fontSize: 'clamp(10px,1vw,14px)', color: P.bright, letterSpacing: '0.08em',
};
const bottomBar = {
  flexShrink: 0, background: '#000', borderTop: `1px solid ${P.hairStrong}`,
  padding: 'clamp(10px,1.6vh,18px) 0', display: 'flex', justifyContent: 'center',
};
const ticks = { display: 'flex', gap: 10 };
const tick = { width: 34, height: 3, background: P.hair };
const tickActive = { background: P.gold };
const tickDone = { background: P.hairStrong };

const titleCardWrap = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: 'clamp(14px,2.2vh,28px)', padding: '4vh 6vw', textAlign: 'center',
};
const titleCardRule = { width: 'clamp(80px,10vw,160px)', height: 1, background: P.hairStrong };
const titleCardKicker = {
  fontFamily: mono, fontSize: 'clamp(11px,1.1vw,15px)', color: P.gold,
  letterSpacing: '0.4em', textTransform: 'uppercase',
};
const titleCardHeadline = {
  fontFamily: fraunces, fontStyle: 'italic', fontWeight: 700, color: P.cream,
  fontSize: 'clamp(30px,5.2vw,80px)', lineHeight: 1.08, margin: 0,
};
const titleCardWrong = { color: P.gold };
const titleCardByline = {
  fontFamily: oswald, fontSize: 'clamp(13px,1.3vw,19px)', color: P.mute,
  letterSpacing: '0.14em', textTransform: 'uppercase',
};

const trophyGrid = {
  width: '100%', height: '100%', overflow: 'auto', boxSizing: 'border-box',
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2.4vw',
  alignContent: 'center', padding: '4vh 6vw',
};
const trophyCol = { border: `1px solid ${P.hair}`, background: 'rgba(10,22,40,0.55)', padding: '1.6vw' };
const trophyColHead = { marginBottom: '1.2vw', paddingBottom: '0.8vw', borderBottom: `1px solid ${P.hair}` };
const trophyMeetName = { fontFamily: oswald, fontWeight: 600, color: P.bright, fontSize: 'clamp(15px,1.5vw,22px)' };
const trophyMeetMeta = { fontFamily: mono, fontSize: 'clamp(9px,0.85vw,12px)', color: P.mute, letterSpacing: '0.1em', marginTop: 4 };
const trophyChip = {
  display: 'flex', alignItems: 'center', gap: 12,
  border: `1px solid ${P.hairStrong}`, background: P.goldWash, padding: '10px 12px',
};
const trophyChipLabel = { fontFamily: oswald, fontSize: 'clamp(12px,1.1vw,16px)', color: P.cream };
const trophyChipPlace = { fontFamily: mono, fontSize: 'clamp(10px,0.9vw,13px)', color: P.gold, letterSpacing: '0.08em', marginTop: 2 };
