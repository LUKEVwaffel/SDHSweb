// Shared admin theme tokens. Single source for palette, fonts, and the scale
// system (type ramp, spacing, radius, shadow, motion). Panels + primitives pull
// from here so a size/rhythm change happens in one place, not 40 inline values.
export const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.58)', faint: 'rgba(244,236,216,0.38)',
  hair: 'rgba(201,169,97,0.22)', hairStrong: 'rgba(201,169,97,0.4)',
  goldWash: 'rgba(201,169,97,0.08)', navyLift: '#1B3358',
  red: '#C0392B', green: '#27AE60', blue: '#2980B9',
};

export const mono = "'JetBrains Mono', monospace";
export const oswald = "Oswald, sans-serif";
export const inter = "Inter, sans-serif";
// Editorial display face — variable (300–900, roman + italic). Reserved for
// hero numerals/headline treatments (kiosk widgets); Inter/Oswald stay the
// workhorse UI faces elsewhere.
export const fraunces = "'Fraunces', serif";

// Type ramp — bigger, more confident than the old 8–13px cramp.
export const fs = {
  micro: 10, tiny: 11, xs: 12, sm: 13, base: 15,
  md: 17, lg: 20, xl: 26, xxl: 34, display: 46,
};

// Spacing scale (px). Use these instead of ad-hoc numbers.
export const sp = {
  1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64,
};

export const radius = { sm: 5, md: 8, lg: 12, xl: 18, pill: 999 };

// Liquid-glass treatment for the floating shell (sidebar, topbar, cards) —
// DISPATCH AI reskin. Reuses the same P.navy/P.deep/P.gold palette above,
// just a different surface treatment (blur, layered gradient, inset
// highlight) instead of the old flat bordered boxes.
//
// REDUCE_GLASS_BLUR: the Range TV machine keeps TV Remote open all day with
// this blur active. Flip this to true (one line, no redesign) if that
// machine or any other stutters — it swaps every blur() value below for a
// much cheaper one instead of dropping backdrop-filter entirely.
export const REDUCE_GLASS_BLUR = false;

export const glass = {
  blur: REDUCE_GLASS_BLUR ? 'blur(8px)' : 'blur(28px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.08)',
  // Floating panel fill (sidebar, command palette) — subtle top highlight
  // stripe layered over the navy-to-deep gradient.
  panelFill: 'linear-gradient(180deg,rgba(255,255,255,0.05),transparent 30%), linear-gradient(180deg,rgba(30,54,92,0.62),rgba(12,26,48,0.7))',
  // Card fill (Overview action cards, tool-step cards, etc).
  cardFill: 'linear-gradient(180deg,rgba(30,54,92,0.5),rgba(12,26,48,0.58))',
  cardFillHover: 'linear-gradient(180deg,rgba(30,54,92,0.62),rgba(12,26,48,0.68))',
  insetHi: 'inset 0 1px 0 rgba(255,255,255,0.1)',
  outerGlow: '0 20px 50px rgba(0,0,0,0.4)',
  outerGlowLg: '0 28px 70px rgba(0,0,0,0.5)',
  hoverWash: 'rgba(255,255,255,0.06)',
  // Gold gradient fills for pills/active chips (nav active row, primary CTA).
  goldFill: 'linear-gradient(180deg,#EDD08A,#C9A961)',
  goldFillStrong: 'linear-gradient(180deg,#EDD08A,#B8964F)',
  // Soft gold-tinted highlight for an active nav row (not a solid fill).
  navActiveFill: 'linear-gradient(180deg,rgba(201,169,97,0.22),rgba(201,169,97,0.1))',
  navActiveRing: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(201,169,97,0.35)',
  // Atmospheric backdrop for the whole shell (Dashboard.jsx root) — two soft
  // navy/gold glows plus a faint grid texture, straight from the mockup's
  // root container. Without SOMETHING varied behind them, backdrop-filter
  // blur on the floating glass panels has almost nothing to blur and barely
  // reads as glass at all — this is what the blur is actually blurring.
  bgGlow: 'radial-gradient(900px 600px at 18% -10%, rgba(44,78,138,0.6), transparent 60%), radial-gradient(800px 600px at 100% 110%, rgba(201,169,97,0.14), transparent 60%)',
  gridTexture: 'linear-gradient(rgba(201,169,97,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(201,169,97,0.22) 1px, transparent 1px)',
};

export const shadow = {
  sm: '0 2px 8px rgba(0,0,0,0.28)',
  md: '0 8px 24px rgba(0,0,0,0.35)',
  lg: '0 18px 44px rgba(0,0,0,0.45)',
  glow: '0 0 0 3px rgba(201,169,97,0.22)',
};

// Gold focus ring for keyboard + click focus on inputs/controls.
export const focusRing = `0 0 0 3px rgba(201,169,97,0.28)`;

export const ease = 'cubic-bezier(0.16, 1, 0.3, 1)';
