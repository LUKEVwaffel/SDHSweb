import { P, mono, oswald } from '../theme';

// Shared visual kit for the rifle portal tabs — pulled out once all nine tabs
// had converged on the same ad-hoc bordered-box-and-table look with no
// hierarchy. Mirrors the decorative language already established by the
// public /rifle page and RifleAnalysis.jsx (corner brackets, mono section
// labels, stat tiles) so the portal reads as the same product instead of a
// plain CRUD backend bolted onto a designed frontend.

export function Brackets({ size = 14, opacity = 0.4 }) {
  const s = `1px solid rgba(201,169,97,${opacity})`;
  return (
    <>
      {[
        { top: 0, left: 0, borderTop: s, borderLeft: s },
        { top: 0, right: 0, borderTop: s, borderRight: s },
        { bottom: 0, left: 0, borderBottom: s, borderLeft: s },
        { bottom: 0, right: 0, borderBottom: s, borderRight: s },
      ].map((st, i) => (
        <div key={i} style={{ position: 'absolute', width: size, height: size, ...st, pointerEvents: 'none' }} />
      ))}
    </>
  );
}

export function SectionLabel({ tag, title, sub }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.28em', opacity: 0.75 }}>{tag}</div>
        <div style={{ flex: 1, height: 1, background: P.hair }} />
      </div>
      {title && <div style={{ fontFamily: oswald, fontSize: 18, fontWeight: 600, color: P.cream, letterSpacing: '0.02em' }}>{title}</div>}
      {sub && <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, marginTop: 4, lineHeight: 1.6 }}>{sub}</div>}
    </div>
  );
}

export function Card({ children, style, bracket = true, padding = '18px 20px' }) {
  return (
    <div style={{ position: 'relative', border: `1px solid ${P.hair}`, background: P.navy, padding, ...style }}>
      {bracket && <Brackets size={14} opacity={0.3} />}
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, tone }) {
  const color = tone === 'up' ? P.win : tone === 'down' ? P.warn : tone === 'red' ? P.red : P.cream;
  return (
    <div style={{ border: `1px solid ${P.hair}`, padding: '10px 12px', background: 'rgba(10,22,40,0.5)' }}>
      <div style={{ fontFamily: mono, fontSize: 8, color: P.gold, letterSpacing: '0.2em', opacity: 0.7, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: oswald, fontSize: 22, color, letterSpacing: '0.02em', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: mono, fontSize: 8, color: P.faint, letterSpacing: '0.1em', marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

export function StatGrid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>{children}</div>;
}

export function Badge({ tone = 'gold', children }) {
  const c = { gold: P.gold, win: P.win, warn: P.warn, red: P.red, mute: P.mute }[tone] || P.gold;
  return (
    <span style={{
      fontFamily: mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
      color: c, border: `1px solid ${c}66`, background: `${c}12`, padding: '3px 9px', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

export function EmptyState({ children }) {
  return (
    <div style={{ border: `1px dashed ${P.hair}`, padding: '22px 18px', textAlign: 'center', fontFamily: mono, fontSize: 12, color: P.mute, letterSpacing: '0.04em' }}>
      {children}
    </div>
  );
}

export const th = (align = 'left') => ({
  fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.16em', opacity: 0.75, textTransform: 'uppercase',
  textAlign: align, padding: '9px 10px', borderBottom: `1px solid ${P.hair}`, whiteSpace: 'nowrap', background: P.deep,
});

export const td = (align = 'left') => ({
  fontFamily: mono, fontSize: 12, color: P.cream, textAlign: align, padding: '8px 10px',
  borderBottom: `1px solid ${P.hair}`,
});

export function PrimaryBtn({ children, style, ...rest }) {
  return (
    <button {...rest} style={{
      background: P.gold, color: P.ink, border: 'none', fontFamily: mono, fontSize: 12, fontWeight: 700,
      letterSpacing: '0.1em', padding: '11px 18px', cursor: rest.disabled ? 'not-allowed' : 'pointer',
      opacity: rest.disabled ? 0.5 : 1, ...style,
    }}>
      {children}
    </button>
  );
}

export function GhostBtn({ children, style, active, ...rest }) {
  return (
    <button {...rest} style={{
      background: 'transparent', border: `1px solid ${active ? P.gold : P.hairStrong}`,
      color: active ? P.gold : P.mute, fontFamily: mono, fontSize: 11, letterSpacing: '0.08em',
      padding: '7px 14px', cursor: rest.disabled ? 'not-allowed' : 'pointer', opacity: rest.disabled ? 0.5 : 1, ...style,
    }}>
      {children}
    </button>
  );
}

export function DangerBtn({ children, style, ...rest }) {
  return (
    <button {...rest} style={{
      background: 'transparent', border: `1px solid ${P.red}`, color: P.red, fontFamily: mono, fontSize: 11,
      letterSpacing: '0.06em', padding: '6px 12px', cursor: rest.disabled ? 'not-allowed' : 'pointer',
      opacity: rest.disabled ? 0.5 : 1, ...style,
    }}>
      {children}
    </button>
  );
}

export const inputStyle = {
  background: P.deep, border: `1px solid ${P.hair}`, color: P.cream, fontFamily: mono, fontSize: 13,
  padding: '9px 11px', outline: 'none',
};

export const fieldLabel = { fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.12em' };
