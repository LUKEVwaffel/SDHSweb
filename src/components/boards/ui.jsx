import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Small shared pieces for /boards. Kept together — each is tiny and only
// used inside this feature.

const PIN_LENGTH = 4;

/**
 * On-screen 4-digit keypad + hardware keyboard support. Calls onComplete
 * once four digits are in; the caller resets via the `resetKey` prop.
 */
export function PinPad({ onComplete, busy = false, resetKey = 0, error = '' }) {
  const [digits, setDigits] = useState('');
  const [shake, setShake] = useState(false);
  const digitsRef = useRef('');
  const submitTimer = useRef(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  function cancelPending() { clearTimeout(submitTimer.current); submitTimer.current = null; }
  function clear() { if (busy) return; cancelPending(); digitsRef.current = ''; setDigits(''); }
  useEffect(() => { cancelPending(); digitsRef.current = ''; setDigits(''); }, [resetKey]);
  useEffect(() => () => cancelPending(), []);
  useEffect(() => {
    if (!error) return undefined;
    setShake(true);
    const t = setTimeout(() => setShake(false), 420);
    return () => clearTimeout(t);
  }, [error, resetKey]);
  function press(d) {
    if (busy || digitsRef.current.length >= PIN_LENGTH) return;
    const next = digitsRef.current + d;
    digitsRef.current = next; setDigits(next);
    if (next.length === PIN_LENGTH) submitTimer.current = setTimeout(() => { submitTimer.current = null; onCompleteRef.current(next); }, 90);
  }
  function back() { if (busy) return; cancelPending(); const next = digitsRef.current.slice(0, -1); digitsRef.current = next; setDigits(next); }
  const actions = useRef({ press, back });
  actions.current = { press, back };
  useEffect(() => {
    function onKey(e) {
      if (e.defaultPrevented || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (/^\d$/.test(e.key)) { e.preventDefault(); actions.current.press(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); actions.current.back(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={shake ? 'tb-shake' : undefined}>
      <div className="tb-pin-dots" aria-label={`${digits.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={`tb-pin-dot${i < digits.length ? ' is-on' : ''}`} />
        ))}
      </div>
      <div className="tb-pinpad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className="tb-pinkey" onClick={() => press(d)} disabled={busy}>{d}</button>
        ))}
        <button type="button" className="tb-pinkey tb-pinkey--fn" onClick={clear} disabled={busy}>Clear</button>
        <button type="button" className="tb-pinkey" onClick={() => press('0')} disabled={busy}>0</button>
        <button type="button" className="tb-pinkey tb-pinkey--fn" onClick={back} disabled={busy} aria-label="Delete digit">⌫</button>
      </div>
      {error && <p role="alert" style={{ color: '#ffb3b5', textAlign: 'center', fontSize: 13.5, margin: '14px 0 0' }}>{error}</p>}
    </div>
  );
}

export function ProgressRing({ value, max, size = 92, label = 'DONE' }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="tb-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle className="tb-ring-track" cx={size / 2} cy={size / 2} r={r} />
        <circle className="tb-ring-fill" cx={size / 2} cy={size / 2} r={r} strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div className="tb-ring-label"><b>{value}<span style={{ display: 'inline', fontSize: 13, color: 'var(--mute)' }}>/{max}</span></b><span>{label}</span></div>
    </div>
  );
}

export function Modal({ children, onClose, wide = false, label }) {
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const focusable = () => [...(dialog.current?.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]') ?? [])].filter((element) => element.getClientRects().length);
    (focusable()[0] ?? dialog.current)?.focus();
    function onKey(event) {
      const dialogs = document.querySelectorAll('[data-board-dialog]');
      if (dialogs[dialogs.length - 1] !== dialog.current) return;
      if (event.key === 'Escape') { event.preventDefault(); close.current?.(); }
      if (event.key === 'Tab') {
        const items = focusable();
        if (!items.length) { event.preventDefault(); dialog.current?.focus(); return; }
        if (event.shiftKey && (document.activeElement === items[0] || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); items[items.length - 1].focus(); }
        else if (!event.shiftKey && (document.activeElement === items[items.length - 1] || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); items[0].focus(); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus(); };
  }, []);
  return createPortal(
    <div className="tb tb-modal-back" style={{ minHeight: 0, background: 'rgba(3,6,12,0.72)' }} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={dialog} data-board-dialog tabIndex={-1} className={`tb-modal tb-card${wide ? ' tb-modal--wide' : ''}`} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>, document.body,
  );
}

export function useToast() {
  const [msg, setMsg] = useState('');
  const timer = useRef(null);
  function show(text) {
    setMsg(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(''), 2600);
  }
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = msg ? createPortal(<div className="tb"><div className="tb-toast" role="status">{msg}</div></div>, document.body) : null;
  return [node, show];
}

export const COMPANY_LABEL = { alpha: 'Alpha', bravo: 'Bravo', charlie: 'Charlie', delta: 'Delta' };

export function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Status chip for a cadet in the queue / tables. */
export function SheetChip({ sheet }) {
  if (!sheet) return <span className="tb-chip tb-chip--todo">Not boarded</span>;
  if (sheet.status === 'draft') return <span className="tb-chip tb-chip--draft">Draft</span>;
  const d = sheet.sai_decision ?? sheet.decision;
  if (d === 'absent') return <span className="tb-chip tb-chip--absent">Absent</span>;
  if (d === 'promote') return <span className="tb-chip tb-chip--promote">Promote{sheet.locked ? ' · signed' : ''}</span>;
  return <span className="tb-chip tb-chip--hold">No promote{sheet.locked ? ' · signed' : ''}</span>;
}
