import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SEASON, PLACE, RaiderCrest, BetaGraduation, PollButtons, hasAnsweredPoll, markShowSeen,
} from './OpticFinale';
import { TrophyCase, trophyCaseDuration } from './OpticTrophies';
import { mountFx, burst, rain, fireworks, haptic, centerOf } from './showFx';
import posthog from '../../lib/posthog';
import './optic-show.css';

// ── Season-finale launch show, played once per device before OPTIC opens.
// A theatre bill, every act something to touch:
//   curtain  Raider logo projected on a closed curtain; PULL it open
//   state    3rd in state, tap the medal to spin it
//   trophies the season trophy case, tap any trophy to inspect it
//   thanks   thank you, families: applause meter + Noblit spotlight
//   optic    OPTIC 2.2 knocks its own BETA tag off
//   poll     bring OPTIC back next year?   (skipped if already answered)
// The spotlight follows your finger, swipe left/right moves between acts,
// then the house lights come up on OPTIC.

const HINT_MS = 2600; // "pull the curtain" hint appears once the logo is up
const AUTO_OPEN_MS = 9000; // nobody touched it: open anyway
const OPEN_MS = 1500; // curtain travel
const EXIT_MS = 900; // house-lights fade into OPTIC
const OPEN_AT_PULL = 0.28; // fraction of a half-screen drag that commits
const SWIPE_PX = 70;
const OVATION_TAPS = 24;
const GRAD_START_MS = 800; // BETA knock-off begins after the act fades in

/** @param {{ onDone: () => void }} props */
export default function OpticShow({ onDone }) {
  const [acts] = useState(() => ['state', 'trophies', 'thanks', 'optic', ...(hasAnsweredPoll() ? [] : ['poll'])]);
  const [act, setAct] = useState(0);
  const [curtain, setCurtain] = useState('projecting'); // projecting | opening | gone
  const [voted, setVoted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const rootRef = useRef(null);
  const fxRef = useRef(null);
  const swipe = useRef(null);
  const spotRaf = useRef(0);

  useEffect(() => mountFx(fxRef.current), []);

  const finish = useCallback((how) => {
    if (leaving) return;
    setLeaving(true);
    markShowSeen();
    posthog.capture('optic_show_finished', { how, act: acts[act] });
    if (how === 'complete') { rain(160); haptic([15, 40, 15]); }
    setTimeout(onDone, how === 'complete' ? EXIT_MS + 500 : EXIT_MS);
  }, [leaving, onDone, acts, act]);

  const curtainRef = useRef('projecting');
  const openCurtain = useCallback(() => {
    if (curtainRef.current !== 'projecting') return;
    curtainRef.current = 'opening';
    setCurtain('opening');
    haptic([10, 25, 18]);
    setTimeout(() => {
      burst(window.innerWidth * 0.08, 60, { count: 70, angle: 30, spread: 50, power: 13 });
      burst(window.innerWidth * 0.92, 60, { count: 70, angle: 150, spread: 50, power: 13 });
    }, 350);
  }, []);

  useEffect(() => {
    if (curtain === 'gone') return undefined;
    const t = curtain === 'projecting'
      ? setTimeout(openCurtain, AUTO_OPEN_MS)
      : setTimeout(() => setCurtain('gone'), OPEN_MS);
    return () => clearTimeout(t);
  }, [curtain, openCurtain]);

  const scene = acts[act];
  const isLast = act === acts.length - 1;
  const stageLive = curtain !== 'projecting';
  const canNext = curtain === 'gone' && !(scene === 'poll' && !voted);

  const go = useCallback((dir) => {
    if (dir > 0) {
      if (!canNext) return;
      haptic(8);
      if (isLast) finish('complete'); else setAct((a) => a + 1);
    } else if (act > 0 && curtain === 'gone') {
      haptic(8);
      setAct((a) => a - 1);
    }
  }, [canNext, isLast, finish, act, curtain]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') finish('escape');
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish, go]);

  // Spotlight follows the finger / cursor (CSS vars, one write per frame).
  function onPointerMove(e) {
    if (spotRaf.current) return;
    const { clientX: x, clientY: y } = e;
    spotRaf.current = requestAnimationFrame(() => {
      spotRaf.current = 0;
      rootRef.current?.style.setProperty('--px', `${(x / window.innerWidth) * 100}%`);
      rootRef.current?.style.setProperty('--py', `${(y / window.innerHeight) * 100}%`);
    });
  }

  // Horizontal swipe between acts; ignores drags that start on interactive
  // pieces (the BETA tag, the curtain) and mostly-vertical scrolls.
  function onTouchStart(e) {
    if (e.target.closest('.show-curtain, .tc-inspect')) { swipe.current = null; return; }
    const t = e.touches[0];
    swipe.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e) {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.6) go(dx < 0 ? 1 : -1);
  }

  const nextDelay = scene === 'trophies' ? `${trophyCaseDuration()}ms` : undefined;

  return (
    <div
      ref={rootRef}
      className="rhea show"
      data-leaving={leaving}
      data-scene={scene}
      role="dialog"
      aria-modal="true"
      aria-label="OPTIC season finale"
      onPointerMove={onPointerMove}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="show-stage">
        <div className="show-spot" aria-hidden="true" />
        <div className="show-floor" aria-hidden="true" />
        <div className="show-motes" aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <span key={i} style={{ '--x': `${(i * 53) % 100}%`, '--t': `${(i % 6) * 0.9}s`, '--s': `${6 + (i % 4) * 2}s` }} />
          ))}
        </div>

        <div className="show-scene" key={scene} data-live={stageLive}>
          {scene === 'state' && <ActState live={stageLive} />}
          {scene === 'trophies' && <TrophyCase />}
          {scene === 'thanks' && <ActThanks />}
          {scene === 'optic' && <ActOptic />}
          {scene === 'poll' && <ActPoll voted={voted} onVoted={() => setVoted(true)} />}
        </div>

        {curtain === 'gone' && (
          <nav className="show-nav" aria-label="Show controls">
            <div className="show-dots">
              {acts.map((a, i) => (
                <button
                  key={a}
                  className="show-dot"
                  data-on={i === act}
                  data-done={i < act}
                  aria-label={`Act ${i + 1}`}
                  disabled={i > act}
                  onClick={() => { if (i < act) setAct(i); }}
                />
              ))}
            </div>
            {canNext && (
              <button
                className="show-next"
                key={`n-${scene}`}
                data-scene={scene}
                style={nextDelay ? { animationDelay: nextDelay } : undefined}
                onClick={() => go(1)}
              >
                <span>{isLast ? 'ENTER OPTIC' : 'NEXT'}</span>
                <span className="show-next-arrow" aria-hidden="true">→</span>
              </button>
            )}
            {scene === 'poll' && !voted && (
              <button className="show-skipq" onClick={() => finish('skip-poll')}>SKIP QUESTION</button>
            )}
            <div className="show-swipe-hint" aria-hidden="true">SWIPE ⇠ ⇢</div>
          </nav>
        )}
      </div>

      {curtain !== 'gone' && <Curtain state={curtain} onOpen={openCurtain} />}

      <canvas ref={fxRef} className="show-fx" aria-hidden="true" />
      <button className="show-skip" onClick={() => finish('skip')}>SKIP SHOW</button>
    </div>
  );
}

// Pull either half (or tap) to part the curtain. --pull 0..1 drives both
// drapes; past OPEN_AT_PULL on release it commits and finishes on its own.
function Curtain({ state, onOpen }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHint(true), HINT_MS);
    return () => clearTimeout(t);
  }, []);

  const setPull = (v) => ref.current?.style.setProperty('--pull', String(v));

  const handlers = state === 'projecting' ? {
    onPointerDown: (e) => {
      drag.current = { x: e.clientX, moved: false };
      e.currentTarget.setPointerCapture?.(e.pointerId);
      ref.current.dataset.drag = 'true';
    },
    onPointerMove: (e) => {
      if (!drag.current) return;
      const dx = Math.abs(e.clientX - drag.current.x);
      if (dx > 6) drag.current.moved = true;
      setPull(Math.min(1, dx / (window.innerWidth / 2)));
    },
    onPointerUp: (e) => {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      ref.current.dataset.drag = 'false';
      const pull = Math.abs(e.clientX - d.x) / (window.innerWidth / 2);
      if (!d.moved || pull > OPEN_AT_PULL) onOpen();
      else setPull(0);
    },
  } : {};

  return (
    <div ref={ref} className="show-curtain" data-state={state} data-drag="false" {...handlers}>
      <div className="show-drape show-drape--l" aria-hidden="true" />
      <div className="show-drape show-drape--r" aria-hidden="true" />
      <div className="show-valance" aria-hidden="true" />

      <div className="show-projection">
        <div className="show-beam" aria-hidden="true" />
        <RaiderCrest className="show-logo" />
        <div className="show-presents">PRESENTS</div>
        <div className="show-presents-sub">THE {SEASON} RAIDER SEASON</div>
      </div>
      <div className="show-dust" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} style={{ '--x': `${(i * 37) % 100}%`, '--t': `${(i % 5) * 0.7}s` }} />
        ))}
      </div>
      {state === 'projecting' && hint && (
        <button className="show-pull" onClick={onOpen}>
          <span className="show-pull-hands" aria-hidden="true">⟵ ⟶</span>
          PULL THE CURTAIN
        </button>
      )}
    </div>
  );
}

function ActState({ live }) {
  const medalRef = useRef(null);
  const [spins, setSpins] = useState(0);

  useEffect(() => {
    if (!live) return undefined;
    const t = setTimeout(() => {
      const { x, y } = centerOf(medalRef.current);
      burst(x, y, { count: 90, power: 11 });
      haptic([12, 30, 12]);
    }, 1250);
    return () => clearTimeout(t);
  }, [live]);

  function spin() {
    setSpins((n) => n + 1);
    const { x, y } = centerOf(medalRef.current);
    const heat = Math.min(spins, 10); // bursts grow the more you spin
    burst(x, y, { count: 40 + heat * 6, power: 9 + heat * 0.8 });
    haptic(14);
  }

  return (
    <section className="act act-state">
      <div className="act-kick">THE {SEASON} RAIDER SEASON</div>
      <div className="act-medal-wrap">
        <button
          ref={medalRef}
          className="act-medal"
          style={{ '--spin': `${spins * 360}deg` }}
          onClick={spin}
          aria-label="Third place in the state. Tap to spin the medal"
        >
          <span className="act-medal-face"><b>3<sup>RD</sup></b><i>STATE</i></span>
        </button>
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
      <div className="act-tap-hint">{spins ? `SPUN ${spins}×` : 'TAP THE MEDAL'}</div>
    </section>
  );
}

function ActThanks() {
  const [claps, setClaps] = useState(0);
  const shoutRef = useRef(null);
  const ovation = claps >= OVATION_TAPS;

  useEffect(() => {
    if (claps !== OVATION_TAPS) return;
    rain(220);
    setTimeout(() => fireworks(5), 200);
    haptic([20, 40, 20, 40, 80]);
  }, [claps]);

  function clap(e) {
    setClaps((n) => n + 1);
    const r = e.currentTarget.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top, {
      count: 5, power: 7, angle: -90, spread: 70, emoji: ['👏', '👏', '👏', '🎉', '⭐'], size: 7, gravity: 0.12,
    });
    haptic(9);
  }

  function hearts() {
    const { x, y } = centerOf(shoutRef.current);
    burst(x, y, { count: 26, power: 8, emoji: ['💛', '💛', '✨'], size: 6, gravity: 0.1 });
    haptic(12);
  }

  return (
    <section className="act act-thanks">
      <div className="act-kick">TO EVERY RAIDER FAMILY</div>
      <h1 className="act-h act-h--big">Thank <span className="accent">you.</span></h1>
      <p className="act-p">
        The early mornings, the long drives, the coolers, the cheering from the
        tree line, the photos. None of this season happens without you, and we
        are eternally grateful.
      </p>
      <button ref={shoutRef} className="act-shout" onClick={hearts}>
        <span className="act-shout-light" aria-hidden="true" />
        <span className="act-shout-kick">A BIG SHOUTOUT</span>
        <span className="act-shout-name">Amber &amp; Jack Noblit</span>
        <span className="act-shout-p">
          Weston&apos;s parents gave our Raiders more of their time this season than
          we could ever repay. Thank you for showing up for every one of these cadets.
        </span>
      </button>
      <div className="act-applause">
        <button className="act-clap" onClick={clap} data-ovation={ovation}>
          <span aria-hidden="true">👏</span> {ovation ? 'STANDING OVATION' : 'APPLAUD THEM'}
        </button>
        <div className="act-meter" aria-label={`Applause ${Math.min(claps, OVATION_TAPS)} of ${OVATION_TAPS}`}>
          <span style={{ transform: `scaleX(${Math.min(claps / OVATION_TAPS, 1)})` }} />
        </div>
      </div>
    </section>
  );
}

function ActOptic() {
  const ref = useRef(null);
  const [play, setPlay] = useState(false);
  // Plays on its own once the act has faded in (no user gesture needed).
  useEffect(() => {
    const t = setTimeout(() => setPlay(true), GRAD_START_MS);
    return () => clearTimeout(t);
  }, []);
  const graduate = useCallback(() => {
    const r = ref.current?.querySelector('.fin-grad-ver')?.getBoundingClientRect();
    if (r) burst(r.left + r.width / 2, r.top + r.height / 2, { count: 110, power: 12, shapes: ['star', 'rect', 'circle'] });
    haptic([15, 30, 25]);
  }, []);
  return (
    <section className="act act-optic" ref={ref}>
      <div className="act-kick">AND ONE MORE THING</div>
      <BetaGraduation play={play} onGraduate={graduate} />
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
  function celebrate(choice) {
    if (choice === 'yes') { fireworks(6); rain(120); haptic([20, 40, 20, 40, 60]); }
    else { burst(window.innerWidth / 2, window.innerHeight * 0.45, { count: 50, power: 8 }); haptic(14); }
    onVoted(choice);
  }
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
      <PollButtons onVoted={celebrate} />
    </section>
  );
}
