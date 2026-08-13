import { P, MONO, DISPLAY } from './creedShared';

// Header bar every game screen shares: back-to-hub + game title + optional
// right-side slot (timer, score, hint toggle — whatever that game needs).
export function GameHeader({ title, onBack, right }) {
  return (
    <div style={{
      background: `linear-gradient(180deg, ${P.navy} 0%, ${P.navyDeep} 100%)`,
      borderBottom: `1px solid ${P.hairline}`,
      padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    }}>
      <button onClick={onBack} style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: P.gold, fontFamily: MONO, fontSize: 10, letterSpacing: '0.28em',
        padding: 0, whiteSpace: 'nowrap', flexShrink: 0,
      }}>← GAMES</button>

      <div style={{ width: 1, height: 20, background: P.hairline, flexShrink: 0 }} />

      <div style={{
        color: P.cream, fontFamily: DISPLAY, fontWeight: 700,
        fontSize: 15, letterSpacing: '0.14em', flex: 1, minWidth: 0,
      }}>{title.toUpperCase()}</div>

      {right && <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

export function GoldButton({ children, onClick, disabled, style }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: disabled ? 'rgba(201,169,97,0.25)' : P.gold,
      color: P.ink, border: 'none', cursor: disabled ? 'default' : 'pointer',
      fontFamily: DISPLAY, fontWeight: 700, fontSize: 12, letterSpacing: '0.18em',
      padding: '11px 24px', ...style,
    }}>{children}</button>
  );
}

export function GhostButton({ children, onClick, style }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', color: P.gold,
      border: `1px solid ${P.hairlineStrong}`, cursor: 'pointer',
      fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em',
      padding: '9px 18px', ...style,
    }}>{children}</button>
  );
}

export function StatChip({ label, value }) {
  return (
    <div style={{
      border: `1px solid ${P.hairline}`, padding: '6px 12px',
      display: 'flex', flexDirection: 'column', gap: 2, minWidth: 64,
    }}>
      <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: '0.2em', color: P.gold, opacity: 0.6 }}>{label}</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 600, color: P.cream }}>{value}</div>
    </div>
  );
}

// Full-screen "you finished" panel shared by every game's end state.
export function ResultPanel({ heading, stats, onRetry, onBack }) {
  return (
    <div style={{
      maxWidth: 520, margin: '48px auto', padding: '0 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center',
    }}>
      <div style={{
        fontFamily: MONO, fontSize: 9, letterSpacing: '0.32em', color: P.gold, opacity: 0.6,
      }}>RESULT</div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 26, letterSpacing: '0.1em', color: P.cream }}>{heading}</div>
      {stats && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {stats.map(s => <StatChip key={s.label} {...s} />)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <GoldButton onClick={onRetry}>TRY AGAIN</GoldButton>
        <GhostButton onClick={onBack}>ALL GAMES</GhostButton>
      </div>
    </div>
  );
}
