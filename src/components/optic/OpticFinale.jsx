import { useEffect, useRef, useState } from 'react';
import { supabase as SB } from '../../lib/supabaseClient';
import { getDeviceId } from '../../lib/fingerprint';
import { isStandalone } from './pwa';
import posthog from '../../lib/posthog';
import './optic-finale.css';

// ── Final comp of the 2026 season (Hamilton County Raider Championship at
// Central, 2026-10-03). Everything season-ending lives here so the next
// season's reset is one import swap in Optic.jsx, not a hunt through it:
//   FinaleBanner      "last comp / 3rd in state" header, locked + open feed
//   ThankYouCard      thanks to every family + the Noblit shoutout
//   BetaGraduation    replaces the "what's new" card: BETA comes off 2.2
//   NextYearPoll      one-tap "bring OPTIC back next year?" on launch

const SEASON = '2026';
const PLACE = 'Central High School';
const POLL_KEY = 'optic_next_year_v1';
const POLL_CAMPAIGN = 'optic-next-year-2026';
const POLL_DELAY_MS = 900;
const POLL_THANKS_MS = 1800;

/** @param {{ compact?: boolean }} props */
export function FinaleBanner({ compact = false }) {
  return (
    <section className="fin-banner" data-compact={compact} aria-label="Final competition of the season">
      <div className="fin-banner-kick">
        <span className="fin-dot" aria-hidden="true" />
        FINAL COMP · {SEASON} SEASON
      </div>
      <div className="fin-banner-row">
        <div className="fin-medal" aria-label="Third place in the state">
          <b>3<sup>RD</sup></b>
          <i>IN STATE</i>
        </div>
        <div className="fin-banner-copy">
          <h2 className="fin-banner-h">
            One last <span className="accent">time.</span>
          </h2>
          <p className="fin-banner-p">
            This is the last Raider comp of the season, at {PLACE}. We finished
            third in the state, and we are bringing everything we have.
          </p>
        </div>
      </div>
    </section>
  );
}

export function ThankYouCard() {
  return (
    <section className="rhea-card2 fin-thanks" aria-label="Thank you, families">
      <div className="rhea-card2-kick">TO EVERY RAIDER FAMILY</div>
      <h3 className="fin-thanks-h">Thank you.</h3>
      <p className="rhea-card2-p">
        The early mornings, the long drives, the coolers, the cheering from the
        tree line, the photos. None of this season happens without you, and we
        are eternally grateful.
      </p>

      <div className="fin-shout">
        <div className="fin-shout-kick">A BIG SHOUTOUT</div>
        <div className="fin-shout-name">Amber &amp; Jack Noblit</div>
        <p className="fin-shout-p">
          Weston&apos;s parents gave our Raiders more of their time this season
          than we could ever repay. Thank you for showing up for every one of
          these cadets.
        </p>
      </div>
    </section>
  );
}

// The 2.2 card plays once it scrolls into view: BETA gets struck through,
// knocked off, and 2.2 settles in gold. Reduced motion lands on the final
// frame (optic.css collapses every .rhea animation to ~0ms, fill: both).
export function BetaGraduation() {
  const ref = useRef(null);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setPlay(true); return undefined; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setPlay(true); io.disconnect(); }
    }, { threshold: 0.45 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} className="rhea-card2 fin-grad" data-play={play} aria-label="OPTIC 2.2 is out of beta">
      <div className="fin-grad-stage" aria-hidden="true">
        <span className="fin-grad-word">OPTIC</span>
        <span className="fin-grad-ver">
          2.2
          <span className="fin-grad-beta">
            BETA
            <span className="fin-grad-strike" />
          </span>
        </span>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="fin-spark" style={{ '--a': `${i * 36}deg`, '--d': `${i % 2 ? 46 : 64}px` }} />
        ))}
        <span className="fin-grad-shine" />
      </div>
      <div className="fin-grad-stamp" aria-hidden="true">OFFICIAL RELEASE</div>

      <div className="fin-grad-body">
        <div className="rhea-card2-kick">OPTIC 2.2 · OUT OF BETA</div>
        <p className="rhea-card2-p">
          OPTIC started this season as a beta. Every fix since then came from
          you: the team filters, the event filters, photo alerts, saving on
          iPhone, the smoother feed. You filled out the surveys and told us
          what broke, and that is why the beta tag comes off today.
        </p>
        <p className="rhea-card2-p fin-grad-sign">Thank you for the feedback, parents. This one is yours.</p>
      </div>
    </section>
  );
}

function hasAnsweredPoll() {
  try { return !!localStorage.getItem(POLL_KEY); } catch { return false; }
}
function markPoll(value) {
  try { localStorage.setItem(POLL_KEY, value); } catch { /* private mode */ }
}

const POLL_OPTIONS = [
  { id: 'yes', label: 'YES, BRING IT BACK' },
  { id: 'maybe', label: 'MAYBE' },
  { id: 'no', label: 'NO' },
];

/**
 * One question for every OPTIC user on launch. Answered once per device;
 * "ASK ME LATER" only hides it for this visit.
 * @param {{ hold?: boolean }} props  hold = another sheet is up, wait
 */
export function NextYearPoll({ hold = false }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState('ask'); // ask | sending | thanks | err

  useEffect(() => {
    if (hold || hasAnsweredPoll()) return undefined;
    const t = setTimeout(() => setOpen(true), POLL_DELAY_MS);
    return () => clearTimeout(t);
  }, [hold]);

  useEffect(() => {
    if (state !== 'thanks') return undefined;
    const t = setTimeout(() => setOpen(false), POLL_THANKS_MS);
    return () => clearTimeout(t);
  }, [state]);

  if (!open || hold) return null;

  async function vote(choice) {
    if (state === 'sending') return;
    setState('sending');
    const fp = await getDeviceId().catch(() => null);
    const { error } = await SB.from('optic_next_year_votes').insert({
      campaign_id: POLL_CAMPAIGN, vote: choice, standalone: isStandalone(), voter_fp: fp,
    });
    if (error) { setState('err'); return; }
    markPoll(choice);
    posthog.capture('optic_next_year_vote', { vote: choice });
    setState('thanks');
  }

  return (
    <div className="rhea-wt" role="dialog" aria-modal="true" aria-labelledby="fin-poll-h">
      <div className="rhea-wt-card fin-poll">
        {state === 'thanks' ? (
          <div className="fin-poll-done">
            <div className="fin-poll-check" aria-hidden="true">✓</div>
            <h2 className="rhea-wt-h">Thank you.</h2>
            <p className="rhea-wt-p">Got it. Enjoy the last comp.</p>
          </div>
        ) : (
          <>
            <div className="rhea-wt-step">ONE QUICK QUESTION</div>
            <h2 id="fin-poll-h" className="rhea-wt-h">
              Should we bring OPTIC back <span className="accent">next year?</span>
            </h2>
            <p className="rhea-wt-p">
              This is the last comp of the {SEASON} season. Your answer decides
              whether we build it again.
            </p>
            <div className="fin-poll-opts">
              {POLL_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  className="fin-poll-opt"
                  data-primary={o.id === 'yes'}
                  disabled={state === 'sending'}
                  onClick={() => vote(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {state === 'err' && (
              <p className="rhea-card2-err">Could not send that. Check signal and tap again.</p>
            )}
            <div className="rhea-wt-foot">
              <button className="rhea-wt-skip" onClick={() => setOpen(false)}>ASK ME LATER</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
