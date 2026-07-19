const P = {
  navy: '#142847',
  ink: '#06101F',
  gold: '#C9A961',
  goldBright: '#E8C77A',
  cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.6)',
  hairline: 'rgba(201,169,97,0.25)',
};

const JROTC = '/assets/army-jrotc.png';

export default function Hero({ setActive }) {
  return (
    <section style={{
      position: 'relative',
      background: `radial-gradient(ellipse at 30% 20%, ${P.navy} 0%, ${P.ink} 70%)`,
      minHeight: 'calc(100svh - 92px)', overflow: 'hidden',
      borderBottom: `1px solid ${P.hairline}`,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* scanline overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgba(201,169,97,0.022) 3px, rgba(201,169,97,0.022) 4px)`,
      }} />

      {/* large radar mark — right side */}
      <div style={{
        position: 'absolute', right: -120, top: '50%', transform: 'translateY(-50%)',
        width: 720, height: 720, opacity: 0.95,
      }}>
        <svg width="720" height="720" viewBox="0 0 200 200" style={{ position: 'absolute', inset: 0 }}>
          {[40, 60, 80, 95].map((r, i) => (
            <circle key={i} cx="100" cy="100" r={r} fill="none"
              stroke={P.gold} strokeWidth="0.5" opacity={0.12 + i * 0.04} />
          ))}
        </svg>
        <svg width="720" height="720" viewBox="0 0 200 200"
          style={{ position: 'absolute', inset: 0 }} className="hp-cw-12">
          <defs>
            <linearGradient id="sw2" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={P.gold} stopOpacity="0" />
              <stop offset="100%" stopColor={P.gold} stopOpacity="0.18" />
            </linearGradient>
          </defs>
          <path d="M 100 100 L 100 5 A 95 95 0 0 1 195 100 Z" fill="url(#sw2)" />
        </svg>
        <svg width="720" height="720" viewBox="0 0 200 200"
          style={{ position: 'absolute', inset: 0 }} className="hp-ccw-9">
          <circle cx="100" cy="100" r="92" fill="none"
            stroke={P.gold} strokeWidth="0.5" opacity="0.4"
            strokeDasharray="20 4" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={JROTC} alt="" className="hp-glow"
            style={{ width: 360, height: 'auto', opacity: 0.9 }} />
        </div>
      </div>

      {/* hero copy */}
      <div style={{
        position: 'relative', zIndex: 2, flex: 1,
        width: '100%', maxWidth: 1400, margin: '0 auto',
        padding: 'clamp(32px, 5vh, 56px) 32px',
        display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 60,
        alignContent: 'center', alignItems: 'center',
      }}>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '6px 12px', border: `1px solid ${P.hairline}`,
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
            letterSpacing: '0.32em', color: P.gold,
            marginBottom: 22,
          }}>
            <span className="hp-blink" style={{ color: P.goldBright }}>●</span>
            <span>EST · TOP 5% NATIONAL · AJROTC</span>
          </div>

          <h1 style={{
            color: P.cream, fontFamily: 'Oswald, sans-serif', fontWeight: 700,
            fontSize: 'clamp(48px, 6vw, 72px)', lineHeight: 0.92, letterSpacing: '0.01em',
            margin: 0,
          }}>
            HONOR.<br />
            <span style={{ color: P.gold }}>COURAGE.</span><br />
            COMMITMENT.
          </h1>

          <p style={{
            color: P.mute, fontFamily: 'Inter, sans-serif',
            fontSize: 16, lineHeight: 1.55, marginTop: 20, maxWidth: 480,
          }}>
            We are the Trojan Battalion, a U.S. Army Junior ROTC program at Soddy
            Daisy High School. We train cadets to lead, serve, and excel through
            drill, raiders, rifle, and academic competition.
          </p>

          <div style={{ display: 'flex', gap: 12, marginTop: 26, alignItems: 'center' }}>
            <button onClick={() => setActive('cadet-manual')}
              onMouseEnter={e => { e.currentTarget.style.background = P.goldBright; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 24px -12px rgba(201,169,97,0.7)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = P.gold; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              style={{
                background: P.gold, border: 'none', cursor: 'pointer',
                color: P.ink, fontFamily: 'Oswald, sans-serif',
                fontSize: 13, letterSpacing: '0.2em', fontWeight: 700,
                padding: '14px 26px',
                transition: 'background 0.18s, transform 0.18s, box-shadow 0.18s',
              }}>
              OPEN CADET MANUAL →
            </button>
            <button onClick={() => setActive('staff')}
              onMouseEnter={e => { e.currentTarget.style.borderColor = P.gold; e.currentTarget.style.color = P.goldBright; e.currentTarget.style.background = 'rgba(201,169,97,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = P.hairline; e.currentTarget.style.color = P.cream; e.currentTarget.style.background = 'transparent'; }}
              style={{
                background: 'transparent', border: `1px solid ${P.hairline}`, cursor: 'pointer',
                color: P.cream, fontFamily: 'Oswald, sans-serif',
                fontSize: 13, letterSpacing: '0.2em', fontWeight: 600,
                padding: '14px 26px',
                transition: 'border-color 0.18s, color 0.18s, background 0.18s',
              }}>
              MEET THE CADETS
            </button>
          </div>

          {/* stat strip */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            marginTop: 32, paddingTop: 18,
            borderTop: `1px solid ${P.hairline}`, gap: 24,
          }}>
            {[
              { v: 'TOP 5%', l: 'Programs nationally' },
              { v: '7',      l: 'Specialty teams' },
              { v: '30+',    l: 'Years strong' },
            ].map((s, i) => (
              <div key={i}>
                <div style={{
                  color: P.gold, fontFamily: 'Oswald, sans-serif',
                  fontSize: 32, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1,
                }}>{s.v}</div>
                <div style={{
                  color: P.mute, fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9, letterSpacing: '0.22em', marginTop: 8,
                }}>{s.l.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* telemetry strip */}
      <div style={{
        position: 'relative', zIndex: 2,
        borderTop: `1px solid ${P.hairline}`,
        background: 'rgba(0,0,0,0.3)',
        padding: '12px 32px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
        letterSpacing: '0.22em', color: P.gold, opacity: 0.85,
        maxWidth: '100%',
      }}>
        <span>LAT 35.2438° N · LONG 85.1814° W</span>
        <span>SODDY DAISY · TENNESSEE</span>
        <span>UNIT // TN-051</span>
        <span className="hp-blink">[ STATUS · OK ]</span>
      </div>
    </section>
  );
}
