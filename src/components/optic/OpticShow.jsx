import { useCallback, useEffect, useState } from 'react';
import {
  SEASON, PLACE, RaiderCrest, BetaGraduation, PollButtons, hasAnsweredPoll, markShowSeen,
} from './OpticFinale';
import { TrophyCase, trophyCaseDuration } from './OpticTrophies';
import posthog from '../../lib/posthog';
import './optic-show.css';

// ── Season-finale launch show, played once per device before OPTIC opens.
// A theatre bill in five acts:
//   curtain  Raider logo projected on a closed curtain, then it opens
//   state    3rd in state
//   trophies the full season trophy case, shelf by shelf
//   thanks   thank you, families + the Amber & Jack Noblit spotlight
//   optic    OPTIC 2.2 sheds its BETA tag
//   poll     bring OPTIC back next year?   (skipped if already answered)
// then the house lights come up and OPTIC (onboarding or the app) loads.

const PROJECT_MS = 3600; // logo on the curtain before it parts
const OPEN_MS = 1900; // curtain travel
const EXIT_MS = 650; // house-lights fade into OPTIC

/** @param {{ onDone: () => void }} props */
export default function OpticShow({ onDone }) {
  const [acts] = useState(() => ['state', 'trophies', 'thanks', 'optic', ...(hasAnsweredPoll() ? [] : ['poll'])]);
  const [act, setAct] = useState(0);
  const [curtain, setCurtain] = useState('projecting'); // projecting | opening | gone
  const [voted, setVoted] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const finish = useCallback((how) => {
    if (leaving) return;
    setLeaving(true);
    markShowSeen();
    posthog.capture('optic_show_finished', { how, act: acts[act] });
    setTimeout(onDone, EXIT_MS);
  }, [leaving, onDone, acts, act]);

  useEffect(() => {
    if (curtain === 'gone') return undefined;
    const t = setTimeout(
      () => setCurtain((c) => (c === 'projecting' ? 'opening' : 'gone')),
      curtain === 'projecting' ? PROJECT_MS : OPEN_MS,
    );
    return () => clearTimeout(t);
  }, [curtain]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') finish('escape'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  const scene = acts[act];
  const isLast = act === acts.length - 1;
  const stageLive = curtain !== 'projecting';

  function next() {
    if (isLast) finish('complete');
    else setAct((a) => a + 1);
  }

  return (
    <div className="rhea show" data-leaving={leaving} role="dialog" aria-modal="true" aria-label="OPTIC season finale">
      <div className="show-stage">
        <div className="show-spot" aria-hidden="true" />
        <div className="show-floor" aria-hidden="true" />

        <div className="show-scene" key={scene} data-live={stageLive}>
          {scene === 'state' && <ActState />}
          {scene === 'trophies' && <TrophyCase />}
          {scene === 'thanks' && <ActThanks />}
          {scene === 'optic' && <ActOptic />}
          {scene === 'poll' && <ActPoll voted={voted} onVoted={() => setVoted(true)} />}
        </div>

        {curtain === 'gone' && (
          <nav className="show-nav" aria-label="Show controls">
            <div className="show-dots" aria-hidden="true">
              {acts.map((a, i) => <span key={a} className="show-dot" data-on={i === act} data-done={i < act} />)}
            </div>
            {!(scene === 'poll' && !voted) && (
              <button
                className="show-next"
                key={`n-${scene}`}
                data-scene={scene}
                style={scene === 'trophies' ? { animationDelay: `${trophyCaseDuration()}ms` } : undefined}
                onClick={next}
              >
                {isLast ? 'ENTER OPTIC →' : 'NEXT →'}
              </button>
            )}
            {scene === 'poll' && !voted && (
              <button className="show-skipq" onClick={() => finish('skip-poll')}>SKIP QUESTION</button>
            )}
          </nav>
        )}
      </div>

      {curtain !== 'gone' && <Curtain state={curtain} onSkip={() => setCurtain('opening')} />}

      <button className="show-skip" onClick={() => finish('skip')}>SKIP SHOW</button>
    </div>
  );
}

function Curtain({ state, onSkip }) {
  return (
    <div className="show-curtain" data-state={state} onClick={state === 'projecting' ? onSkip : undefined}>
      <div className="show-drape show-drape--l" aria-hidden="true" />
      <div className="show-drape show-drape--r" aria-hidden="true" />
      <div className="show-valance" aria-hidden="true" />

      <div className="show-projection">
        <div className="show-beam" aria-hidden="true" />
        <RaiderCrest className="show-logo" />
        <div className="show-presents">SDHS JROTC PRESENTS</div>
        <div className="show-presents-sub">THE {SEASON} RAIDER SEASON</div>
      </div>
      <div className="show-dust" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} style={{ '--x': `${(i * 37) % 100}%`, '--t': `${(i % 5) * 0.7}s` }} />
        ))}
      </div>
    </div>
  );
}

function ActState() {
  return (
    <section className="act act-state">
      <div className="act-kick">THE {SEASON} RAIDER SEASON</div>
      <div className="act-medal-wrap">
        <div className="act-medal" aria-hidden="true"><b>3<sup>RD</sup></b><i>STATE</i></div>
        <div className="act-burst" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} style={{ '--a': `${i * (360 / 14)}deg`, '--d': `${i % 2 ? 92 : 128}px` }} />
          ))}
        </div>
      </div>
      <h1 className="act-h">Third in <span className="accent">the state.</span></h1>
      <p className="act-p">
        One more comp to go. The Hamilton County Raider Championship at {PLACE} is
        our last of the season, and we&apos;re leaving everything on the course.
      </p>
    </section>
  );
}

function ActThanks() {
  return (
    <section className="act act-thanks">
      <div className="act-kick">TO EVERY RAIDER FAMILY</div>
      <h1 className="act-h act-h--big">Thank <span className="accent">you.</span></h1>
      <p className="act-p">
        The early mornings, the long drives, the coolers, the cheering from the
        tree line, the photos. None of this season happens without you, and we
        are eternally grateful.
      </p>
      <div className="act-shout">
        <div className="act-shout-light" aria-hidden="true" />
        <div className="act-shout-kick">A BIG SHOUTOUT</div>
        <div className="act-shout-name">Amber &amp; Jack Noblit</div>
        <p className="act-shout-p">
          Weston&apos;s parents gave our Raiders more of their time this season than
          we could ever repay. Thank you for showing up for every one of these cadets.
        </p>
      </div>
    </section>
  );
}

function ActOptic() {
  return (
    <section className="act act-optic">
      <div className="act-kick">AND ONE MORE THING</div>
      <BetaGraduation play />
      <p className="act-p act-optic-p">
        OPTIC started this season as a beta. Every fix since came from you: team
        and event filters, photo alerts, saving on iPhone, a smoother feed. You
        told us what broke, and that is why the beta tag comes off today.
      </p>
      <p className="act-p act-sign">Thank you for the feedback, parents. This one is yours.</p>
    </section>
  );
}

function ActPoll({ voted, onVoted }) {
  if (voted) {
    return (
      <section className="act act-poll">
        <div className="act-check" aria-hidden="true">✓</div>
        <h1 className="act-h">Thank <span className="accent">you.</span></h1>
        <p className="act-p">Noted. Now let&apos;s go watch the last comp.</p>
      </section>
    );
  }
  return (
    <section className="act act-poll">
      <div className="act-kick">ONE QUICK QUESTION</div>
      <h1 className="act-h">Should we bring OPTIC back <span className="accent">next year?</span></h1>
      <p className="act-p">Your answer decides whether we build it again.</p>
      <PollButtons onVoted={onVoted} />
    </section>
  );
}
