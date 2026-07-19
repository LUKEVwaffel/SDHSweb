import { P, mono, inter } from '../theme';

// Shared admin primitives. Extracted verbatim from the old single-file admin.

export function Btn({ onClick, children, variant = 'default', style = {}, disabled = false }) {
  const base = {
    border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: mono, fontSize: 10, letterSpacing: '0.15em',
    fontWeight: 600, padding: '7px 14px', opacity: disabled ? 0.5 : 1,
    transition: 'background 0.15s',
  };
  const variants = {
    default: { background: P.navy, color: P.cream, border: `1px solid ${P.hair}` },
    gold: { background: P.gold, color: P.ink },
    danger: { background: P.red, color: '#fff' },
    ghost: { background: 'transparent', color: P.gold, border: `1px solid ${P.hair}` },
    green: { background: P.green, color: '#fff' },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

export function Card({ children, style = {}, ...rest }) {
  return (
    <div style={{ background: P.navy, border: `1px solid ${P.hair}`, padding: 16, ...style }} {...rest}>
      {children}
    </div>
  );
}

export function Label({ children }) {
  return (
    <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.2em', marginBottom: 4 }}>
      {children}
    </div>
  );
}

export function Input({ value, onChange, multiline, style = {}, ...rest }) {
  const base = {
    width: '100%', background: P.deep, border: `1px solid ${P.hair}`,
    color: P.cream, fontFamily: inter, fontSize: 12, padding: '6px 8px',
    outline: 'none', resize: 'vertical', boxSizing: 'border-box', ...style,
  };
  if (multiline) return <textarea value={value} onChange={onChange} style={{ ...base, minHeight: 72 }} {...rest} />;
  return <input value={value} onChange={onChange} style={base} {...rest} />;
}

export function PanelHeader({ title, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${P.hair}` }}>
      <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.2em' }}>{title}</div>
      {action}
    </div>
  );
}
