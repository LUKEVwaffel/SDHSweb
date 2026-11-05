import { useEffect, useRef, useState } from "react";
const shown = new Set();
function confetti(canvas, reduced) {
  const context = canvas.getContext("2d");
  if (!context) return () => {};
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  let width = window.innerWidth, height = window.innerHeight;
  canvas.width = width * scale;
  canvas.height = height * scale;
  context.scale(scale, scale);
  const colors = ["#c5a866", "#758b68", "#cf927e", "#8ba6b2", "#e3c67b"];
  const makePieces = (count) =>
    Array.from({ length: count }, (_, i) => ({
      x: i % 2 ? width * .1 : width * .9,
      y: height * .58,
      vx: (i % 2 ? 1 : -1) * (2 + Math.random() * 10),
      vy: -5 - Math.random() * 15,
      rotation: Math.random() * 6,
      spin: (Math.random() - .5) * .22,
      size: 4 + Math.random() * 6,
      color: colors[i % colors.length],
    }));
  const pieces = makePieces(180);
  let bursts = 0;
  let frame, start = performance.now(), previous = start;
  const draw = (now) => {
    const elapsed = now - start, delta = Math.min((now - previous) / 16.7, 2);
    previous = now;
    if (!reduced && elapsed > 1400 && bursts === 0) {
      pieces.push(...makePieces(90));
      bursts = 1;
    }
    if (!reduced && elapsed > 2800 && bursts === 1) {
      pieces.push(...makePieces(90));
      bursts = 2;
    }
    context.clearRect(0, 0, width, height);
    for (const p of pieces) {
      if (!reduced) {
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.vy += .17 * delta;
        p.vx *= .996;
        p.rotation += p.spin * delta;
      } else {
        p.x = Math.random() * width;
        p.y = Math.random() * height;
      }
      context.save();
      context.translate(p.x, p.y);
      context.rotate(p.rotation);
      context.globalAlpha = reduced
        ? .6
        : Math.min(1, Math.max(0, (8000 - elapsed) / 1500));
      context.fillStyle = p.color;
      context.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * .55);
      context.restore();
    }
    if (!reduced && elapsed < 8000) frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(frame);
    context.clearRect(0, 0, width, height);
  };
}
export default function ChiefBirthday({ email }) {
  const [visible, setVisible] = useState(false);
  const dialog = useRef(null), canvas = useRef(null), button = useRef(null);
  useEffect(() => {
    if (!email) return;
    const key = `chief-birthday-2026-11-05:${email}`;
    let seen = shown.has(key);
    try {
      seen = seen || localStorage.getItem(key) === "seen";
    } catch { /* The in-memory guard still works. */ }
    if (seen) return;
    shown.add(key);
    try {
      localStorage.setItem(key, "seen");
    } catch { /* No storage is required to use the portal. */ }
    setVisible(true);
  }, [email]);
  useEffect(() => {
    if (!visible) return;
    const opener = document.activeElement;
    const node = dialog.current;
    node.showModal();
    button.current?.focus();
    const stop = confetti(
      canvas.current,
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    return () => {
      stop();
      node.close();
      if (opener?.isConnected) opener.focus();
    };
  }, [visible]);
  if (!visible) return null;
  return (
    <dialog
      ref={dialog}
      className="bo-birthday"
      aria-labelledby="bo-birthday-title"
      aria-describedby="bo-birthday-subtitle"
      onCancel={(event) => {
        event.preventDefault();
        setVisible(false);
      }}
    >
      <canvas ref={canvas} className="bo-confetti" aria-hidden="true" />
      <button
        className="bo-birthday-close"
        aria-label="Dismiss birthday celebration"
        onClick={() => setVisible(false)}
      >
        ×
      </button>
      <div className="bo-birthday-message">
        <p className="bo-eyebrow">A little celebration before the work</p>
        <h1 id="bo-birthday-title">
          HAPPY BIRTHDAY<br />
          <span>CHIEF</span>
        </h1>
        <p id="bo-birthday-subtitle">
          We love you
        </p>
        <button
          ref={button}
          className="bp-confirm-yes"
          onClick={() => setVisible(false)}
        >
          Thank you — open the portal
        </button>
      </div>
    </dialog>
  );
}
