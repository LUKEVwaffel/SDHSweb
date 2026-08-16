import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

const SCHOOL_EMAIL_SUFFIX = '@students.hcde.org';

// Username-only input with a fixed school-domain suffix rendered inline —
// admins type just the username; onChange(fullEmail) gets the composed
// address. Pasting a full address into the field strips a duplicate suffix
// rather than doubling it up.
export function SuffixEmailInput({ value, onChange, suffix = SCHOOL_EMAIL_SUFFIX, style = {}, ...rest }) {
  const [focused, setFocused] = useState(false);
  const raw = value || '';
  const username = raw.toLowerCase().endsWith(suffix) ? raw.slice(0, -suffix.length) : raw;
  const handleChange = (e) => {
    let v = e.target.value;
    if (v.toLowerCase().endsWith(suffix)) v = v.slice(0, -suffix.length);
    onChange(v.trim() ? `${v}${suffix}` : '');
  };
  return (
    <div style={{
      width: '100%', display: 'flex', alignItems: 'center', background: P.deep,
      border: `1px solid ${focused ? P.gold : P.hair}`, borderRadius: radius.sm,
      boxShadow: focused ? focusRing : 'none', boxSizing: 'border-box',
      transition: `border-color 0.15s ${ease}, box-shadow 0.15s ${ease}`,
      ...style,
    }}>
      <input
        value={username}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
          color: P.cream, fontFamily: inter, fontSize: fs.sm, padding: '11px 0 11px 13px',
        }}
        {...rest}
      />
      <span style={{
        flexShrink: 0, color: P.faint, fontFamily: inter, fontSize: fs.sm,
        padding: '11px 13px 11px 4px', userSelect: 'none',
      }}>{suffix}</span>
    </div>
  );
}

// Select — same border/radius/focus treatment as Input, gold chevron instead
// of the OS default arrow, so dropdowns stop looking bolted onto the form.
export function Select({ value, onChange, options, style = {}, ...rest }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value}
      onChange={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', background: P.deep, border: `1px solid ${focused ? P.gold : P.hair}`,
        color: P.cream, fontFamily: mono, fontSize: fs.tiny, letterSpacing: '0.06em',
        padding: '11px 30px 11px 13px', outline: 'none', cursor: 'pointer', boxSizing: 'border-box',
        borderRadius: radius.sm, boxShadow: focused ? focusRing : 'none',
        appearance: 'none', WebkitAppearance: 'none',
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23C9A961'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
        transition: `border-color 0.15s ${ease}, box-shadow 0.15s ${ease}`,
        ...style,
      }}
      {...rest}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

const STATUS_PILL_SIZES = {
  compact: { padding: '6px 10px', fontSize: fs.micro },
  regular: { padding: '9px 8px', fontSize: fs.tiny, flex: 1 },
};

// Shared 3-state consent toggle (`items` = [{id,label,color}]), rendered as a
// single segmented control — one bordered track, active segment filled and
// sliding between positions — instead of 3 separate free-floating buttons.
// One component at two sizes instead of the 3 hand-rolled copies that used to
// drift apart (cadet roster row, cadet detail panel, staff consent banner).
export function StatusPills({ items, value, onChange, size = 'regular', style = {} }) {
  const s = STATUS_PILL_SIZES[size] || STATUS_PILL_SIZES.regular;
  const activeIndex = Math.max(0, items.findIndex((it) => it.id === value));
  const activeItem = items[activeIndex];
  return (
    <div style={{
      position: 'relative', display: 'flex', padding: 3, gap: 2,
      background: P.deep, border: `1px solid ${P.hair}`, borderRadius: radius.sm,
      ...style,
    }}>
      <div style={{
        position: 'absolute', top: 3, bottom: 3, left: 3,
        width: `calc(${100 / items.length}% - 2.5px)`,
        transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * 2}px))`,
        background: activeItem?.color, borderRadius: Math.max(radius.sm - 2, 3),
        transition: `transform 0.2s ${ease}, background 0.2s ${ease}`,
      }} />
      {items.map((it) => {
        const active = value === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            style={{
              position: 'relative', zIndex: 1, flex: 1,
              fontFamily: mono, fontWeight: 600, letterSpacing: '0.1em', cursor: 'pointer',
              border: 'none', background: 'transparent',
              color: active ? (it.id === 'pending' ? P.ink : '#fff') : P.faint,
              transition: `color 0.2s ${ease}`,
              ...s,
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// Inline confirmation/error line — one shape for messages that used to be
// styled ad hoc at every call site (add-cadet, save, mailing list, contact).
export function Toast({ children, tone = 'success', style = {} }) {
  if (!children) return null;
  return (
    <div style={{
      fontFamily: mono, fontSize: fs.tiny, color: tone === 'error' ? P.red : P.green,
      display: 'flex', alignItems: 'center', gap: 6, ...style,
    }}>
      <span>{tone === 'error' ? '✕' : '✓'}</span>{children}
    </div>
  );
}

// Portal-based modal — overlay click and Escape both close. Used for flows
// that need more than an inline row (e.g. add-cadet's full field set).
export function Modal({ open, onClose, title, children, footer, width = 480 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(6,16,31,0.72)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: sp[4],
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: width, maxHeight: '86vh', overflowY: 'auto',
        background: P.navy, border: `1px solid ${P.gold}`, borderRadius: radius.lg,
        boxShadow: shadow.lg, padding: sp[5], boxSizing: 'border-box',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: sp[4], paddingBottom: sp[3], borderBottom: `1px solid ${P.hair}`,
        }}>
          <div style={{ fontFamily: mono, fontSize: fs.sm, color: P.gold, letterSpacing: '0.16em' }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={{
            all: 'unset', cursor: 'pointer', color: P.faint, fontSize: fs.md, lineHeight: 1, padding: 4,
          }}>✕</button>
        </div>
        {children}
        {footer && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: sp[2],
            marginTop: sp[4], paddingTop: sp[3], borderTop: `1px solid ${P.hair}`,
          }}>{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
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
