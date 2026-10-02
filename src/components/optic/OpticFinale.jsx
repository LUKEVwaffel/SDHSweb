import { useEffect, useRef, useState } from 'react';
import { supabase as SB } from '../../lib/supabaseClient';
import { getDeviceId } from '../../lib/fingerprint';
import { isStandalone } from './pwa';
import posthog from '../../lib/posthog';
import './optic-finale.css';

// ── Final comp of the 2026 season (Hamilton County Raider Championship at
// Central, 2026-10-03). Pieces shared by the launch show (OpticShow.jsx) and
// the locked / live screens in Optic.jsx. Next season: drop OpticShow from
// Optic() and these strips from OpticLocked / OpticApp.

export const SEASON = '2026';
export const PLACE = 'Central High School';
// Real logo file wins when present; RaiderCrest falls back to the SVG below.
const RAIDER_LOGO_SRC = '/images/raiders/raider-logo.png';

const SHOW_KEY = 'optic_show_2026_final';
const POLL_KEY = 'optic_next_year_v1';
const POLL_CAMPAIGN = 'optic-next-year-2026';

const readFlag = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const writeFlag = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export const hasSeenShow = () => !!readFlag(SHOW_KEY);
export const markShowSeen = () => writeFlag(SHOW_KEY, '1');
export const hasAnsweredPoll = () => !!readFlag(POLL_KEY);

/** Raider team logo: the real image if it's in /public, else an SVG crest. */
export function RaiderCrest({ className }) {
  const [useImg, setUseImg] = useState(true);
  if (useImg) {
    return (
      <img
        className={className}
        src={RAIDER_LOGO_SRC}
        alt="SDHS Raiders"
        width="512"
        height="512"
        onError={() => setUseImg(false)}
      />
    );
  }
  return (
    <svg className={className} viewBox="0 0 240 280" role="img" aria-label="SDHS Raiders">
      <path d="M120 8 L224 40 V140 C224 206 176 248 120 272 C64 248 16 206 16 140 V40 Z"
        fill="none" stroke="currentColor" strokeWidth="8" />
      <path d="M120 26 L208 53 V140 C208 196 168 232 120 253 C72 232 32 196 32 140 V53 Z"
        fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="3" />
      <text x="120" y="78" textAnchor="middle" fill="currentColor"
        style={{ font: '700 17px Oswald, sans-serif', letterSpacing: '0.32em' }}>SDHS</text>
      <text x="120" y="170" textAnchor="middle" fill="currentColor"
        style={{ font: '700 96px Oswald, sans-serif' }}>R</text>
      <path d="M58 190 H182" stroke="currentColor" strokeWidth="3" />
      <text x="120" y="218" textAnchor="middle" fill="currentColor"
        style={{ font: '700 22px Oswald, sans-serif', letterSpacing: '0.26em' }}>RAIDERS</text>
    </svg>
  );
}

/** Condensed "3rd in state" line for the locked screen + live feed. */
export function StateStrip({ onReplay }) {
  return (
    <section className="fin-strip" aria-label="Third place in the state">
      <div className="fin-strip-medal" aria-hidden="true">3<sup>RD</sup></div>
      <div className="fin-strip-copy">
        <div className="fin-strip-h">3rd in State</div>
        <div className="fin-strip-sub">FINAL COMP · {SEASON} RAIDER SEASON</div>
      </div>
      {onReplay && (
        <button className="fin-strip-replay" onClick={onReplay} aria-label="Replay the season show">
          ▶ REPLAY
        </button>
      )}
    </section>
  );
}

/** Static "official 2.2" banner, the resting state of BetaGraduation. */
export function OfficialBanner() {
  return (
    <section className="fin-official" aria-label="OPTIC 2.2 official release">
      <div className="fin-official-ver">OPTIC <span>2.2</span></div>
      <div className="fin-official-stamp">OFFICIAL RELEASE</div>
      <p className="fin-official-p">Out of beta, built from your feedback. Thank you, parents.</p>
    </section>
  );
}

// BETA gets struck through, knocked off with sparks, and 2.2 settles in gold.
// `play` comes from the show's scene clock; reduced motion lands on the final
// frame (optic.css collapses every .rhea animation to ~0ms, fill: both).
export function BetaGraduation({ play }) {
  return (
    <div className="fin-grad" data-play={play}>
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
        <span className="fin-grad-stamp">OFFICIAL RELEASE</span>
      </div>
    </div>
  );
}

const POLL_OPTIONS = [
  { id: 'yes', label: 'YES, BRING IT BACK' },
  { id: 'maybe', label: 'MAYBE' },
  { id: 'no', label: 'NO' },
];

/** "Bring OPTIC back next year?" buttons; one stored answer per device. */
export function PollButtons({ onVoted }) {
  const [state, setState] = useState('ask'); // ask | sending | err
  const sentRef = useRef(false);

  useEffect(() => () => { sentRef.current = true; }, []);

  async function vote(choice) {
    if (state === 'sending') return;
    setState('sending');
    const fp = await getDeviceId().catch(() => null);
    const { error } = await SB.from('optic_next_year_votes').insert({
      campaign_id: POLL_CAMPAIGN, vote: choice, standalone: isStandalone(), voter_fp: fp,
    });
    if (sentRef.current) return;
    if (error) { setState('err'); return; }
    writeFlag(POLL_KEY, choice);
    posthog.capture('optic_next_year_vote', { vote: choice });
    onVoted(choice);
  }

  return (
    <>
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
    </>
  );
}
