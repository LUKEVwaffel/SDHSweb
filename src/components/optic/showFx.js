// ── Tiny canvas particle engine for the finale show: confetti, sparks,
// emoji (applause, hearts), fireworks. One full-screen canvas, one rAF loop
// that only runs while particles are alive. No-ops under reduced motion.

const GOLD = ['#FBE7B0', '#E8C77A', '#C9A961', '#F4ECD8', '#FFF6DA'];
const MAX_PARTICLES = 700;
const GRAVITY = 0.22;
const DRAG = 0.985;

let canvas = null;
let ctx = null;
let dpr = 1;
let particles = [];
let raf = 0;

const reduced = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function resize() {
  if (!canvas) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
}

/** Attach the engine to a canvas; returns a detach function. */
export function mountFx(el) {
  canvas = el;
  ctx = el.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  return () => {
    window.removeEventListener('resize', resize);
    cancelAnimationFrame(raf);
    raf = 0;
    particles = [];
    canvas = null;
    ctx = null;
  };
}

/** Short vibration on phones that support it (Android). */
export function haptic(pattern = 12) {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}

function spawn(p) {
  if (particles.length >= MAX_PARTICLES) particles.shift();
  particles.push(p);
}

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Radial / directional burst at a viewport point.
 * @param {number} x
 * @param {number} y
 * @param {{count?:number, power?:number, angle?:number, spread?:number,
 *   colors?:string[], shapes?:string[], emoji?:string[], size?:number, gravity?:number, life?:number}} [o]
 */
export function burst(x, y, o = {}) {
  if (!ctx || reduced()) return;
  const {
    count = 60, power = 9, angle = -90, spread = 360, colors = GOLD,
    shapes = ['rect', 'rect', 'circle', 'star'], emoji = null, size = 7,
    gravity = GRAVITY, life = 1,
  } = o;
  for (let i = 0; i < count; i += 1) {
    const a = ((angle + rand(-spread / 2, spread / 2)) * Math.PI) / 180;
    const v = power * rand(0.45, 1.1);
    spawn({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.3, 0.3),
      size: size * rand(0.6, 1.3),
      color: pick(colors),
      shape: emoji ? 'emoji' : pick(shapes),
      text: emoji ? pick(emoji) : null,
      alpha: 1,
      decay: rand(0.008, 0.016) / life,
      gravity,
      flip: rand(0, Math.PI * 2),
    });
  }
  start();
}

/** Confetti falling from the top edge across the whole screen. */
export function rain(count = 140) {
  if (!ctx || reduced()) return;
  for (let i = 0; i < count; i += 1) {
    spawn({
      x: rand(0, window.innerWidth), y: rand(-window.innerHeight * 0.6, -10),
      vx: rand(-1.2, 1.2), vy: rand(1, 4),
      rot: rand(0, 6.28), vr: rand(-0.2, 0.2),
      size: rand(5, 10), color: pick(GOLD), shape: pick(['rect', 'rect', 'circle']),
      alpha: 1, decay: rand(0.004, 0.008), gravity: 0.06, flip: rand(0, 6.28),
    });
  }
  start();
}

/** A few rockets that climb and pop into gold bursts. */
export function fireworks(shots = 4) {
  if (!ctx || reduced()) return;
  for (let i = 0; i < shots; i += 1) {
    setTimeout(() => {
      const x = rand(window.innerWidth * 0.15, window.innerWidth * 0.85);
      const y = rand(window.innerHeight * 0.15, window.innerHeight * 0.4);
      burst(x, y, { count: 70, power: 7, shapes: ['circle', 'star'], gravity: 0.08, size: 5 });
    }, i * 320);
  }
}

function drawStar(r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function frame() {
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const h = window.innerHeight;
  particles = particles.filter((p) => p.alpha > 0 && p.y < h + 40);
  for (const p of particles) {
    p.vx *= DRAG;
    p.vy = p.vy * DRAG + p.gravity;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.flip += 0.12;
    p.alpha -= p.decay;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (p.shape === 'emoji') {
      ctx.font = `${p.size * 3.2}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.text, 0, 0);
    } else {
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
      else if (p.shape === 'star') drawStar(p.size * 0.7);
      else ctx.fillRect(-p.size / 2, (-p.size / 2) * Math.abs(Math.cos(p.flip)), p.size, p.size * 0.6 * Math.abs(Math.cos(p.flip)) + 1);
    }
    ctx.restore();
  }
  raf = particles.length ? requestAnimationFrame(frame) : 0;
  if (!raf) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function start() {
  if (!raf) raf = requestAnimationFrame(frame);
}

/** Centre point of an element in viewport coordinates. */
export function centerOf(el) {
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
