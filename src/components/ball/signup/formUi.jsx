import { P, mono } from '../../admin/theme';

// Tiny shared form primitives for the signup wizard steps — sharp edges, gold
// focus, matches the DISPATCH admin input style but standalone (public page,
// no admin/shared/ui import — that file assumes an admin session context).

export function Label({ children }) {
  return <div style={{ fontFamily: mono, fontSize: 11, color: P.mute, letterSpacing: '0.1em', marginBottom: 6 }}>{children}</div>;
}

export function TextInput(props) {
  return (
    <input
      {...props}
      style={{
        width: '100%', boxSizing: 'border-box', background: P.navy, border: `1px solid ${P.hair}`,
        color: P.cream, fontFamily: mono, fontSize: 14, padding: '11px 12px', outline: 'none',
        ...(props.style || {}),
      }}
    />
  );
}

export function TextArea(props) {
  return (
    <textarea
      {...props}
      style={{
        width: '100%', boxSizing: 'border-box', background: P.navy, border: `1px solid ${P.hair}`,
        color: P.cream, fontFamily: mono, fontSize: 14, padding: '11px 12px', outline: 'none', resize: 'vertical',
        ...(props.style || {}),
      }}
    />
  );
}

export function Btn({ variant = 'gold', children, style, ...rest }) {
  const styles = {
    gold: { background: P.gold, color: P.ink, border: 'none' },
    ghost: { background: 'transparent', color: P.mute, border: `1px solid ${P.hair}` },
  };
  return (
    <button
      {...rest}
      style={{
        cursor: rest.disabled ? 'not-allowed' : 'pointer', opacity: rest.disabled ? 0.5 : 1,
        fontFamily: mono, fontSize: 13, letterSpacing: '0.1em', fontWeight: 700,
        padding: '13px 26px', ...styles[variant], ...style,
      }}
    >
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
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
