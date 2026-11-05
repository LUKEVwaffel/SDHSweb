import { useEffect, useRef } from 'react';
import { P, mono, oswald, fraunces, fs, sp, ease } from '../admin/theme.js';

// Full-screen /tv takeover for Chief's 24th birthday. Unlike the Ball portal
// version (ChiefBirthday.jsx), there is no dismiss button — the wall TV loops
// confetti continuously. TvKiosk.jsx only mounts this on CHIEF_BIRTHDAY_DATE,
// so the kiosk falls back to its normal board the next day on its own.

const COLORS = [P.gold, P.bright, P.cream, '#8BA6B2', '#CF927E', '#758B68'];
const PIECE_COUNT = 260;

function BirthdayStyles() {
  return (
    <style>{`
      @keyframes birthdayRise {
        from { opacity: 0; transform: translateY(24px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .birthday-rise { animation: birthdayRise 900ms ${ease} both; }
      @media (prefers-reduced-motion: reduce) {
        .birthday-rise { animation: none; }
      }
    `}</style>
  );
}

function makePiece(width, height, scatter) {
  return {
    x: Math.random() * width,
    y: scatter ? Math.random() * height : -20 - Math.random() * height * 0.3,
    vx: (Math.random() - 0.5) * 1.6,
    vy: 1.4 + Math.random() * 2.8,
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.12,
    sway: Math.random() * Math.PI * 2,
    size: 8 + Math.random() * 12,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

// Endless confetti rain: pieces that fall off the bottom respawn at the top.
function useConfettiLoop(canvasRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!context) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0, height = 0, pieces = [], frame = 0;

    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * scale;
      canvas.height = height * scale;
      context.setTransform(scale, 0, 0, scale, 0, 0);
      pieces = Array.from({ length: PIECE_COUNT }, () => makePiece(width, height, true));
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        if (!reduced) {
          p.sway += 0.03;
          p.x += p.vx + Math.sin(p.sway) * 0.8;
          p.y += p.vy;
          p.rotation += p.spin;
          if (p.y > height + 30) pieces[i] = makePiece(width, height, false);
        }
        context.save();
        context.translate(p.x, p.y);
        context.rotate(p.rotation);
        context.fillStyle = p.color;
        context.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.5);
        context.restore();
      }
      if (!reduced) frame = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [canvasRef]);
}

export default function TvChiefBirthdayScreen() {
  const canvasRef = useRef(null);
  useConfettiLoop(canvasRef);

  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'hidden',
      background: `radial-gradient(ellipse at 50% 40%, ${P.navyLift} 0%, ${P.navy} 38%, ${P.ink} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <BirthdayStyles />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />
      <main style={{ position: 'relative', textAlign: 'center', padding: sp[16] }}>
        <div className="birthday-rise" style={{
          fontFamily: mono, fontSize: fs.lg, color: P.gold,
          letterSpacing: '0.32em', textTransform: 'uppercase', marginBottom: sp[8],
        }}>
          Trojan Battalion · November 5
        </div>
        <h1 className="birthday-rise" style={{
          margin: 0, fontFamily: oswald, fontWeight: 700, color: P.cream,
          fontSize: 'clamp(4rem, 1rem + 9vw, 11rem)', lineHeight: 0.95,
          letterSpacing: '0.02em', animationDelay: '150ms',
        }}>
          HAPPY BIRTHDAY
          <span style={{
            display: 'block', fontFamily: fraunces, fontStyle: 'italic',
            fontWeight: 800, color: P.bright,
            fontSize: 'clamp(5rem, 1rem + 13vw, 16rem)', lineHeight: 1,
            textShadow: '0 0 48px rgba(232,199,122,0.35)',
          }}>
            CHIEF
          </span>
        </h1>
        <p className="birthday-rise" style={{
          margin: `${sp[10]}px 0 0`, fontFamily: oswald, color: P.cream,
          fontSize: 'clamp(1.75rem, 0.8rem + 2.6vw, 4rem)', letterSpacing: '0.04em',
          animationDelay: '350ms',
        }}>
          Congrats on turning <strong style={{ color: P.bright }}>24</strong>
        </p>
      </main>
    </div>
  );
}
