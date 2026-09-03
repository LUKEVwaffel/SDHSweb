import { P, mono, ease } from '../../admin/theme';
import { Spinner } from '../ballUi';

// Tiny shared form primitives for the signup wizard steps — sharp edges, gold
// focus (via the .ball-input class in ball.css), matches the DISPATCH admin
// input style but standalone (public page, no admin/shared/ui import — that
// file assumes an admin session context).

export function Label({ children }) {
  return <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, letterSpacing: '0.1em', marginBottom: 6 }}>{children}</div>;
}

function mergeClass(base, extra) {
  return [base, extra].filter(Boolean).join(' ');
}

export function TextInput({ className, style, ...rest }) {
  return (
    <input
      {...rest}
      className={mergeClass('ball-input', className)}
      style={{
        width: '100%', boxSizing: 'border-box', background: P.navy, border: `1px solid ${P.hair}`,
        color: P.cream, fontFamily: mono, fontSize: 14, padding: '11px 12px', outline: 'none',
        ...(style || {}),
      }}
    />
  );
}

export function TextArea({ className, style, ...rest }) {
  return (
    <textarea
      {...rest}
      className={mergeClass('ball-input', className)}
      style={{
        width: '100%', boxSizing: 'border-box', background: P.navy, border: `1px solid ${P.hair}`,
        color: P.cream, fontFamily: mono, fontSize: 14, padding: '11px 12px', outline: 'none', resize: 'vertical',
        ...(style || {}),
      }}
    />
  );
}

export function Btn({ variant = 'gold', busy = false, children, style, disabled, ...rest }) {
  const styles = {
    gold: { background: P.gold, color: P.ink, border: 'none' },
    ghost: { background: 'transparent', color: P.mute, border: `1px solid ${P.hair}` },
  };
  const isOff = disabled || busy;
  return (
    <button
      {...rest}
      disabled={isOff}
      style={{
        cursor: isOff ? 'not-allowed' : 'pointer', opacity: isOff ? 0.55 : 1,
        fontFamily: mono, fontSize: 13, letterSpacing: '0.1em', fontWeight: 700,
        padding: '13px 26px', display: 'inline-flex', alignItems: 'center', gap: 9,
        transition: `transform 0.16s ${ease}, box-shadow 0.16s ${ease}, opacity 0.16s ${ease}`,
        ...styles[variant], ...style,
      }}
      onMouseEnter={(e) => { if (!isOff) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 26px rgba(201,169,97,0.25)'; } }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {busy && <Spinner size={13} />}
      {children}
    </button>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return <div style={{ fontFamily: mono, fontSize: 12, color: P.red, marginTop: 10 }}>{children}</div>;
}

export function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function Radio({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          style={{
            flex: 1, cursor: 'pointer', fontFamily: mono, fontSize: 12, letterSpacing: '0.06em',
            padding: '11px 8px', border: `1px solid ${value === o.value ? P.gold : P.hair}`,
            background: value === o.value ? P.gold : 'transparent', color: value === o.value ? P.ink : P.mute,
            transition: `background 0.15s ${ease}, border-color 0.15s ${ease}, color 0.15s ${ease}`,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
