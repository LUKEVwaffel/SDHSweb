import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase as SB } from '../../lib/supabaseClient';
import { hasSeenCongrats } from '../../lib/congratsSeen';
import { hasSeenBallSignupPopup, markBallSignupPopupSeen } from '../../lib/ballSignupPopupSeen';
import posthog from '../../lib/posthog';

// First-load takeover advertising Military Ball signups. Mounted ONLY inside
// the "/" route element (see App.jsx) so it can never appear on /survey,
// /raidertv, /tv, /ball/guest, /admin, or any other standalone surface — it is
// a homepage notification only.
//
// Shows once per device (ballSignupPopupSeen.js). Any close — the X, the
// overlay, Escape, "Not now", or clicking through to signup — marks it seen.
// It waits until the Rhea results CongratsPopup has been seen so two takeovers
// never stack, and it hides itself once registration has closed.

const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.62)', faint: 'rgba(244,236,216,0.4)',
  hair: 'rgba(201,169,97,0.28)',
};

const SHOW_DELAY_MS = 1800;

function fmtShort(d) {
  if (!d) return null;
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function BallSignupPopup() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [deadline, setDeadline] = useState(null);

  useEffect(() => {
    if (hasSeenBallSignupPopup()) return undefined;
    // Don't stack on top of the results popup — let that one go first.
    if (!hasSeenCongrats()) return undefined;

    let cancelled = false;
    let timer;

    SB.from('ball_config')
      .select('ball_date, signup_deadline')
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        // Nothing to advertise until the core facts are posted.
        if (!data?.ball_date || !data?.signup_deadline) return;
        // Closed? Compare on the calendar day in the event's zone (US Central),
        // deadline day itself still open — same rule as the wizard + server.
        const todayCentral = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
        if (todayCentral > data.signup_deadline) return;

        setDeadline(data.signup_deadline);
        timer = setTimeout(() => {
          if (cancelled) return;
          setVisible(true);
          requestAnimationFrame(() => setOpen(true));
          posthog.capture('ball_signup_popup_shown');
        }, SHOW_DELAY_MS);
      });

    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  function close(reason) {
    markBallSignupPopupSeen();
    if (reason) posthog.capture('ball_signup_popup_dismissed', { reason });
    setOpen(false);
    setTimeout(() => setVisible(false), 300);
  }

  function startSignup() {
    markBallSignupPopupSeen();
    posthog.capture('ball_signup_popup_cta');
    setOpen(false);
    setTimeout(() => { setVisible(false); navigate('/ball'); }, 200);
  }

  useEffect(() => {
    if (!visible) return undefined;
    function onKey(e) { if (e.key === 'Escape') close('escape'); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Military Ball registration is open"
      onClick={() => close('overlay')}
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        background: 'rgba(4,10,20,0.82)', backdropFilter: 'blur(6px)',
        opacity: open ? 1 : 0, transition: 'opacity 0.3s ease',
      }}
    >
      <div
        className={`bsp-pop ${open ? 'is-open' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: 600, overflow: 'hidden',
          background: `linear-gradient(165deg, ${P.navy} 0%, ${P.deep} 55%, ${P.ink} 100%)`,
          border: `1px solid ${P.hair}`,
          boxShadow: '0 40px 120px -20px rgba(0,0,0,0.7), 0 0 60px -20px rgba(201,169,97,0.25)',
        }}
      >
        {[
          { top: 10, left: 10, bt: 1, bl: 1 },
          { top: 10, right: 10, bt: 1, br: 1 },
          { bottom: 10, left: 10, bb: 1, bl: 1 },
          { bottom: 10, right: 10, bb: 1, br: 1 },
        ].map((c, i) => (
          <div key={i} aria-hidden="true" style={{
            position: 'absolute', width: 16, height: 16, ...c,
            borderTop: c.bt ? `1px solid ${P.gold}` : undefined,
            borderBottom: c.bb ? `1px solid ${P.gold}` : undefined,
            borderLeft: c.bl ? `1px solid ${P.gold}` : undefined,
            borderRight: c.br ? `1px solid ${P.gold}` : undefined,
            opacity: 0.6,
          }} />
        ))}

        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5,
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 3px, rgba(201,169,97,0.03) 3px 4px)',
        }} />

        <button
          type="button"
          onClick={() => close('x')}
          aria-label="Close"
          style={{
            position: 'absolute', top: 14, right: 14, zIndex: 3,
            width: 32, height: 32, cursor: 'pointer', lineHeight: 1, fontSize: 16,
            background: 'transparent', border: `1px solid ${P.hair}`, color: P.mute,
          }}
        >×</button>

        <div style={{ position: 'relative', zIndex: 2, padding: 'clamp(28px, 5vw, 46px)' }}>
          <div className="bsp-row" style={{ '--d': '0.05s',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.32em',
            color: P.gold, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span className="bsp-blink">●</span> TROJAN BATTALION · REGISTRATION OPEN
          </div>

          <h2 className="bsp-row" style={{ '--d': '0.12s',
            fontFamily: 'Oswald, sans-serif', fontWeight: 700,
            fontSize: 'clamp(34px, 7vw, 54px)', letterSpacing: '0.02em',
            color: P.cream, lineHeight: 1, margin: '16px 0 10px',
          }}>
            MILITARY <span style={{ color: P.bright }}>BALL</span>
          </h2>

          <p className="bsp-row" style={{ '--d': '0.18s',
            fontFamily: 'Inter, sans-serif', fontSize: 14.5, lineHeight: 1.6,
            color: P.mute, maxWidth: 440, margin: '0 0 18px',
          }}>
            Signups are open to every cadet. Bring a date or a friend, or come solo —
            payment, dress, and the field trip form are all handled in one form.
          </p>

          {deadline && (
            <div className="bsp-row" style={{ '--d': '0.24s',
              display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 26,
              border: `1px solid ${P.gold}`, background: 'rgba(201,169,97,0.08)',
              padding: '9px 14px', fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11, color: P.cream, letterSpacing: '0.06em',
            }}>
              <span style={{ color: P.gold, letterSpacing: '0.18em' }}>DEADLINE</span>
              Register by <strong>{fmtShort(deadline)}</strong>. No signups after.
            </div>
          )}

          <div className="bsp-row" style={{ '--d': '0.34s', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
            <button
              type="button"
              onClick={startSignup}
              style={{
                background: P.gold, color: P.ink, border: 'none', cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '0.16em', fontWeight: 700,
                padding: '15px 26px', transition: 'background 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = P.bright; e.currentTarget.style.boxShadow = '0 12px 30px -12px rgba(201,169,97,0.8)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = P.gold; e.currentTarget.style.boxShadow = 'none'; }}
            >START SIGNUP →</button>
            <button
              type="button"
              onClick={() => close('not_now')}
              style={{
                background: 'transparent', color: P.mute, border: 'none', cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '0.08em',
                padding: '15px 6px',
              }}
            >Not now</button>
          </div>
        </div>
      </div>

      <style>{`
        .bsp-pop { transform: translateY(18px) scale(0.98); opacity: 0; transition: transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease; }
        .bsp-pop.is-open { transform: translateY(0) scale(1); opacity: 1; }
        .bsp-row { opacity: 0; transform: translateY(10px); }
        .bsp-pop.is-open .bsp-row { animation: bspIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards; animation-delay: var(--d, 0s); }
        @keyframes bspIn { to { opacity: 1; transform: translateY(0); } }
        .bsp-blink { animation: bspBlink 1.4s steps(1) infinite; }
        @keyframes bspBlink { 50% { opacity: 0.25; } }
        @media (prefers-reduced-motion: reduce) {
          .bsp-pop, .bsp-pop.is-open { transition: opacity 0.2s ease; transform: none; }
          .bsp-row { opacity: 1; transform: none; animation: none !important; }
          .bsp-blink { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
