import { useState } from 'react';
import { P, mono, oswald, inter, fs, sp, radius, shadow, focusRing, ease } from '../theme';

// Shared admin primitives. Rebuilt on the token system for a larger, more
// deliberate scale with real hover / focus / active states.

const BTN_SIZES = {
  sm: { fontSize: fs.micro, padding: '8px 14px', letterSpacing: '0.14em' },
  md: { fontSize: fs.tiny,  padding: '11px 20px', letterSpacing: '0.16em' },
  lg: { fontSize: fs.xs,    padding: '14px 26px', letterSpacing: '0.16em' },
};

const BTN_VARIANTS = {
  default: { background: P.navy,       color: P.cream, border: `1px solid ${P.hairStrong}`, hover: P.navyLift },
  gold:    { background: P.gold,       color: P.ink,   border: `1px solid ${P.gold}`,        hover: P.bright },
  danger:  { background: P.red,        color: '#fff',  border: `1px solid ${P.red}`,         hover: '#D64535' },
  ghost:   { background: 'transparent',color: P.gold,  border: `1px solid ${P.hairStrong}`,  hover: P.goldWash },
  green:   { background: P.green,      color: '#fff',  border: `1px solid ${P.green}`,       hover: '#2ECC71' },
};

export function Btn({ onClick, children, variant = 'default', size = 'md', style = {}, disabled = false, ...rest }) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const v = BTN_VARIANTS[variant] || BTN_VARIANTS.default;
  const s = BTN_SIZES[size] || BTN_SIZES.md;
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      disabled={disabled}
      style={{
        fontFamily: mono, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1, borderRadius: radius.sm, whiteSpace: 'nowrap',
        transition: `background 0.15s ${ease}, transform 0.08s ${ease}, box-shadow 0.15s ${ease}`,
        transform: active && !disabled ? 'translateY(1px)' : 'none',
        boxShadow: hover && !disabled ? shadow.sm : 'none',
        ...s,
        ...v,
        background: hover && !disabled ? v.hover : v.background,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({ children, style = {}, hover: enableHover = false, ...rest }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={enableHover ? () => setHover(true) : undefined}
      onMouseLeave={enableHover ? () => setHover(false) : undefined}
      style={{
        background: P.navy, border: `1px solid ${hover ? P.hairStrong : P.hair}`,
        borderRadius: radius.md, padding: sp[5], boxShadow: hover ? shadow.md : shadow.sm,
        transition: `border-color 0.15s ${ease}, box-shadow 0.15s ${ease}`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Label({ children, style = {} }) {
  return (
    <div style={{
      fontFamily: mono, fontSize: fs.tiny, color: P.gold,
      letterSpacing: '0.18em', marginBottom: sp[2], textTransform: 'uppercase', ...style,
    }}>
      {children}
    </div>
  );
}

// Input with focus ring + optional inline error (border + message handled by caller
// via `error` bool). Keeps the same call signature as before plus `error`.
export function Input({ value, onChange, multiline, error = false, style = {}, onFocus, onBlur, ...rest }) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? P.red : (focused ? P.gold : P.hair);
  const base = {
    width: '100%', background: P.deep, border: `1px solid ${borderColor}`,
    color: P.cream, fontFamily: inter, fontSize: fs.sm, padding: '11px 13px',
    outline: 'none', resize: 'vertical', boxSizing: 'border-box', borderRadius: radius.sm,
    boxShadow: focused ? focusRing : 'none',
    transition: `border-color 0.15s ${ease}, box-shadow 0.15s ${ease}`,
    ...style,
  };
  const handleFocus = (e) => { setFocused(true); onFocus?.(e); };
  const handleBlur = (e) => { setFocused(false); onBlur?.(e); };
  if (multiline) return <textarea value={value} onChange={onChange} onFocus={handleFocus} onBlur={handleBlur} style={{ ...base, minHeight: 96, lineHeight: 1.6 }} {...rest} />;
  return <input value={value} onChange={onChange} onFocus={handleFocus} onBlur={handleBlur} style={base} {...rest} />;
}

export function PanelHeader({ title, action, sub }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: sp[4], paddingBottom: sp[3], borderBottom: `1px solid ${P.hair}`, gap: sp[4],
    }}>
      <div>
        <div style={{ fontFamily: mono, fontSize: fs.sm, color: P.gold, letterSpacing: '0.18em' }}>{title}</div>
        {sub && <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute, letterSpacing: '0.1em', marginTop: 5 }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}

// Standard empty-state block — used across panels for a designed "nothing here yet"
// instead of the bare one-liners. `hint` gives the next action.
export function EmptyState({ icon = '◦', title, hint }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: `${sp[12]}px ${sp[6]}px`, gap: sp[3],
      border: `1px dashed ${P.hair}`, borderRadius: radius.md, background: P.goldWash,
    }}>
      <div style={{ fontFamily: oswald, fontSize: fs.xxl, color: P.hairStrong, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.mute, letterSpacing: '0.14em' }}>{title}</div>
      {hint && <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.faint, maxWidth: 320, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}
