// Shared read/edit field primitives for the DISPATCH Ball reservation lists
// (cadet signups in BallOverviewTab, visiting VIPs in BallVipList). Styled on
// the warm-paper review/portal CSS (.rv / .bp-*).

const lbl = { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--rv-faint)', marginBottom: 3 };
const val = { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--rv-ink)', wordBreak: 'break-word' };
export const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 };
export const groupHead = { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--rv-accent)', margin: '0 0 8px' };
export const detailWrap = { padding: '14px 16px 16px', borderTop: '1px solid var(--rv-border)', display: 'flex', flexDirection: 'column', gap: 16 };

export function Field({ label, value }) {
  return <div style={{ minWidth: 0 }}><div style={lbl}>{label}</div><div style={val}>{value ?? '—'}</div></div>;
}

// --- edit primitives -------------------------------------------------------
const editSelect = {
  width: '100%', boxSizing: 'border-box', border: '1px solid var(--rv-border-strong)',
  borderRadius: 8, padding: '9px 11px', fontSize: 13, fontFamily: 'inherit',
  color: 'var(--rv-ink)', background: '#fffefb',
};
export function ELabel({ children }) {
  return <div style={{ ...lbl, color: 'var(--rv-mute)', marginBottom: 6 }}>{children}</div>;
}
export function EText({ label, value, onChange, ...rest }) {
  return (
    <div style={{ minWidth: 0 }}>
      <ELabel>{label}</ELabel>
      <input className="rv-textarea" value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={{ padding: '9px 11px', fontSize: 13 }} {...rest} />
    </div>
  );
}
export function ESelect({ label, value, onChange, options }) {
  return (
    <div style={{ minWidth: 0 }}>
      <ELabel>{label}</ELabel>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} style={editSelect}>
        {options.map((o) => <option key={String(o.value)} value={o.value ?? ''}>{o.label}</option>)}
      </select>
    </div>
  );
}
export function ECheck({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--rv-ink)', cursor: 'pointer' }}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export const GENDER_OPTS = [{ value: null, label: '—' }, { value: 'male', label: 'male' }, { value: 'female', label: 'female' }];
