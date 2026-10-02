import { useState } from 'react';
import { SANDBOX_ROLES, resetSandbox } from './sandboxConfig';

// Bottom bar on /boards/sandbox: switch who you're signed in as (same fake
// data carries across), reset everything, and make it obvious none of it is
// real. Every signature PIN in the sandbox is 1234.
export default function SandboxBar() {
  const current = new URLSearchParams(window.location.search).get('as') || 'alpha';
  const [open, setOpen] = useState(true);

  function go(role) {
    window.location.href = `/boards/sandbox?as=${role}`;
  }
  function reset() {
    if (!window.confirm('Wipe the sandbox and start over with fresh fake data?')) return;
    resetSandbox();
    window.location.reload();
  }

  if (!open) {
    return <button type="button" className="tb-sandbox-pill" onClick={() => setOpen(true)}>SANDBOX ▲</button>;
  }
  return (
    <div className="tb-sandbox" role="region" aria-label="Sandbox controls">
      <div className="tb-sandbox-tag">
        <b>SANDBOX</b>
        <span>Fake data · nothing touches DISPATCH · every PIN is <code>1234</code></span>
      </div>
      <div className="tb-sandbox-roles" role="group" aria-label="Signed in as">
        {SANDBOX_ROLES.map((r) => (
          <button key={r.id} type="button" aria-pressed={current === r.id} onClick={() => go(r.id)}>{r.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" className="tb-btn tb-btn--danger tb-btn--sm" onClick={reset}>Reset</button>
        <button type="button" className="tb-btn tb-btn--ghost tb-btn--sm" onClick={() => setOpen(false)} aria-label="Hide sandbox bar">▼</button>
      </div>
    </div>
  );
}
