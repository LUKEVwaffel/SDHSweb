import { useState, useEffect, useCallback } from 'react';
import posthog from '../../lib/posthog';
import { markOnboardedRhea } from '../../lib/rheaComp';
import { isIos } from './pwa';
import './rhea-onboard.css';

const ROLE_KEY = 'rhea_role';
const haptic = (p) => { try { navigator.vibrate?.(p); } catch { /* unsupported */ } };

// Step graph. Everyone opens on a plain-language "what is this" panel so the
// first question never lands cold. Cadets get an extra "competing vs viewing"
// step; everyone reaches the install screen last. `done` is a terminal
// hand-off screen shown only after a successful install — it is not part of
// the numbered sequence.
function sequence(role) {
  return role === 'cadet'
    ? ['welcome', 'role', 'intent', 'about1', 'about2', 'install']
    : ['welcome', 'role', 'about1', 'about2', 'install'];
}
// Steps that carry a progress dot (welcome is a soft intro, install/done are
// terminal, so none of them count toward "how far along am I").
const dotStepsOf = (role) => sequence(role).filter((s) => s !== 'welcome' && s !== 'install');

function flavor(a) {
  if (a.role === 'cadet' && a.intent === 'competing') {
    return {
      about1: 'Your teammates, coaches, and families all post to the same feed. Check it between events.',
      about2: 'Grab shots at the start line, the rope bridge, the finish. Your people want to see it.',
      install: 'Your people are watching. Give them something to watch.',
    };
  }
  if (a.role === 'cadet') {
    return {
      about1: 'Follow every event as it happens, even the ones you cannot get close to.',
      about2: 'Got a clean angle from the sideline? Add it and the whole program sees it.',
      install: 'Best seat in the house, right in your pocket.',
    };
  }
  return {
    about1: 'Follow the entire competition from wherever you are standing. Every team, every event.',
    about2: 'Snap your cadet in the action and it is in the feed for every other family in seconds.',
    install: 'Follow the whole day without hunting for a link.',
  };
}

/**
 * First-run flow for /rhea. Shown until the visitor finishes it (or opts to
 * continue in the browser). Ends on an install screen that strongly steers
 * toward adding the PWA — with an honest, visible way past it.
 */
export default function RheaOnboarding({ onDone }) {
  const [step, setStep] = useState('welcome');
  const [answers, setAnswers] = useState({ role: null, intent: null });
  const [pending, setPending] = useState(null); // choice id flashing before advance
  const [back, setBack] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    const h = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  const seq = sequence(answers.role);
  const idx = seq.indexOf(step);
  const dotSteps = dotStepsOf(answers.role);
  const dotIdx = dotSteps.indexOf(step);

  const goNext = useCallback((next) => {
    setBack(false);
    setStep(next);
  }, []);

  const goBack = useCallback(() => {
    const s = sequence(answers.role);
    const i = s.indexOf(step);
    if (i <= 0) return;
    setBack(true);
    setStep(s[i - 1]);
  }, [answers.role, step]);

  function choose(key, value, nextStep) {
    haptic(12);
    setAnswers((a) => ({ ...a, [key]: value }));
    setPending(value);
    setTimeout(() => {
      setPending(null);
      // recompute the sequence in case `role` just changed the graph
      if (nextStep) goNext(nextStep);
    }, 240);
  }

  function record(installed) {
    markOnboardedRhea();
    try { if (answers.role) localStorage.setItem(ROLE_KEY, answers.role); } catch { /* private mode */ }
    posthog.capture('rhea_onboarded', {
      role: answers.role || 'unknown',
      intent: answers.intent || null,
      installed: !!installed,
    });
  }

  function finish(installed) {
    haptic(installed ? [10, 30, 10] : 8);
    record(installed);
    onDone();
  }

  // After a real install we do NOT drop the visitor into the browser feed —
  // that makes people forget they just added the app. Show a hand-off screen
  // that points them at the new home-screen icon instead.
  function handoff() {
    haptic([10, 30, 10]);
    record(true);
    setBack(false);
    setStep('done');
  }

  // Fires when the OS actually completes the install (covers the browser-menu
  // "Install" path that never goes through our button).
  useEffect(() => {
    const h = () => { record(true); setBack(false); setStep('done'); };
    window.addEventListener('appinstalled', h);
    return () => window.removeEventListener('appinstalled', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers.role, answers.intent]);

  async function doInstall() {
    if (!installPrompt) return;
    haptic(14);
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (outcome === 'accepted') handoff();
  }

  const f = flavor(answers);

  return (
    <div className="rob" role="dialog" aria-label="Welcome to OPTIC">
      <div className="rob-top">
        <span className="rob-brand">SDHS JROTC · OPTIC</span>
        <div className="rob-dots" aria-hidden="true">
          {dotSteps.map((_, i) => (
            <span
              key={i}
              className="rob-dot"
              data-state={dotIdx < 0 ? 'next' : i < dotIdx ? 'done' : i === dotIdx ? 'now' : 'next'}
            />
          ))}
        </div>
      </div>

      <div className="rob-stage">
        <div className="rob-panel" key={step} data-back={back}>
          {idx > 0 && step !== 'install' && (
            <button className="rob-back" onClick={goBack}>‹ BACK</button>
          )}

          {step === 'welcome' && (
            <>
              <div className="rob-kicker">RHEA COUNTY RAIDER COMPETITION</div>
              <h1 className="rob-h">The whole day, <span className="accent">as it happens.</span></h1>
              <p className="rob-sub">
                This is OPTIC — a shared photo feed for today&apos;s competition. Families and
                cadets post from the stands and the sideline, and everyone sees it live. Nothing
                to sign into. Nothing to download yet.
              </p>
              <div className="rob-vis">
                <span className="rob-vis-glyph">📸</span>
                <span className="rob-vis-txt">
                  ONE FEED · EVERY TEAM · EVERY EVENT · FREE TO WATCH AND TO ADD TO
                </span>
              </div>
              <p className="rob-sub" style={{ fontSize: 13, marginTop: 16 }}>
                First, one quick question so the feed opens to the right place.
              </p>
            </>
          )}

          {step === 'role' && (
            <>
              <div className="rob-kicker">RHEA COUNTY RAIDER COMPETITION</div>
              <h1 className="rob-h">Who is holding <span className="accent">the phone?</span></h1>
              <p className="rob-sub">Quick setup so the feed shows you the right thing. Ten seconds, tops.</p>
              <div className="rob-choices">
                <Choice
                  sel={pending === 'cadet'}
                  onClick={() => choose('role', 'cadet', 'intent')}
                  title="A CADET"
                  desc="On the team or in the program"
                  icon="◈"
                />
                <Choice
                  sel={pending === 'parent'}
                  onClick={() => choose('role', 'parent', 'about1')}
                  title="FAMILY"
                  desc="Parent, sibling, here to cheer"
                  icon="◆"
                />
              </div>
            </>
          )}

          {step === 'intent' && (
            <>
              <div className="rob-kicker">ONE MORE</div>
              <h1 className="rob-h">Are you <span className="accent">competing today?</span></h1>
              <div className="rob-choices">
                <Choice
                  sel={pending === 'competing'}
                  onClick={() => choose('intent', 'competing', 'about1')}
                  title="I'M COMPETING"
                  desc="Running events with a team"
                  icon="▲"
                />
                <Choice
                  sel={pending === 'viewing'}
                  onClick={() => choose('intent', 'viewing', 'about1')}
                  title="HERE FOR THE PHOTOS"
                  desc="Watching and following along"
                  icon="□"
                />
              </div>
            </>
          )}

          {step === 'about1' && (
            <>
              <div className="rob-kicker">WHAT THIS IS</div>
              <h1 className="rob-h">One live feed for <span className="accent">the whole day.</span></h1>
              <p className="rob-sub">{f.about1}</p>
              <div className="rob-vis">
                <span className="rob-vis-glyph">📡</span>
                <span className="rob-vis-txt">
                  EVERY FAMILY&apos;S PHOTOS · EVERY EVENT · UPDATING AS THEY&apos;RE TAKEN
                </span>
              </div>
            </>
          )}

          {step === 'about2' && (
            <>
              <div className="rob-kicker">AND YOU&apos;RE IN IT</div>
              <h1 className="rob-h">See a moment? <span className="accent">Add it.</span></h1>
              <p className="rob-sub">{f.about2}</p>
              <div className="rob-vis">
                <span className="rob-vis-glyph">⚡</span>
                <span className="rob-vis-txt">
                  SNAP · DROP IT IN · IN THE FEED FOR EVERYONE IN SECONDS · NO LOGIN
                </span>
              </div>
            </>
          )}

          {step === 'install' && (
            <>
              <img className="rob-appicon" src="/optic-icon-192.png" alt="OPTIC app icon" width="96" height="96" />
              <div style={{ textAlign: 'center' }}>
                <span className="rob-badge">OFFICIAL EVENT VIEWER</span>
              </div>
              <h1 className="rob-h" style={{ marginTop: 18 }}>
                Put OPTIC on <span className="accent">your home screen.</span>
              </h1>
              <p className="rob-sub">
                The competition runs live in the app all day. One tap from your home screen,
                no browser tab, no login. {f.install}
              </p>
              {isIos() && (
                <div className="rob-ios">
                  Tap the <span className="rob-share">⬆</span> <b>Share</b> button in your browser bar,
                  then choose <b>Add to Home Screen</b>. OPTIC opens like any other app after that.
                </div>
              )}
            </>
          )}

          {step === 'done' && (
            <>
              <img className="rob-appicon" src="/optic-icon-192.png" alt="OPTIC app icon" width="96" height="96" />
              <div style={{ textAlign: 'center' }}>
                <span className="rob-badge rob-badge--ok">✓ ADDED TO YOUR HOME SCREEN</span>
              </div>
              <h1 className="rob-h" style={{ marginTop: 18 }}>
                You&apos;re set. <span className="accent">Open OPTIC from there.</span>
              </h1>
              <p className="rob-sub">
                Close this tab and tap the new <b style={{ color: 'var(--cream)' }}>OPTIC</b> icon
                on your home screen — that&apos;s where today runs live, full screen, no browser bar.
                Keep it handy; the feed updates on its own all day.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="rob-foot">
        {step === 'welcome' && (
          <>
            <button className="rob-cta" onClick={() => goNext(seq[idx + 1])}>START</button>
            <button className="rob-skip" onClick={() => finish(false)}>Skip, just show me the feed</button>
          </>
        )}

        {step !== 'welcome' && step !== 'install' && step !== 'done' && (
          <>
            <button
              className="rob-cta"
              onClick={() => goNext(seq[idx + 1])}
              disabled={step === 'role' || step === 'intent'}
              style={{ display: step === 'role' || step === 'intent' ? 'none' : 'block' }}
            >
              CONTINUE
            </button>
            <button className="rob-skip" onClick={() => finish(false)}>Skip setup</button>
          </>
        )}

        {step === 'install' && (
          <>
            {installPrompt ? (
              <button className="rob-cta" onClick={doInstall}>INSTALL THE APP</button>
            ) : isIos() ? (
              <button className="rob-cta" onClick={handoff}>I&apos;VE ADDED IT</button>
            ) : (
              <button className="rob-cta" onClick={() => finish(true)}>CONTINUE</button>
            )}
            <button className="rob-skip" onClick={() => finish(false)}>Not now, open in browser</button>
          </>
        )}

        {step === 'done' && (
          <>
            <button className="rob-cta" onClick={() => finish(true)}>I&apos;LL OPEN IT FROM MY HOME SCREEN</button>
            <button className="rob-skip" onClick={() => finish(true)}>Keep watching in this tab for now</button>
          </>
        )}
      </div>
    </div>
  );
}

function Choice({ sel, onClick, title, desc, icon }) {
  return (
    <button className="rob-choice" data-sel={sel} onClick={onClick}>
      <span className="rob-choice-i">{icon}</span>
      <span>
        <span className="rob-choice-t">{title}</span>
        <span className="rob-choice-d">{desc}</span>
      </span>
      <span className="rob-choice-arrow">›</span>
    </button>
  );
}
