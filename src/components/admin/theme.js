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

export const radius = { sm: 5, md: 8, lg: 12, pill: 999 };

export const shadow = {
  sm: '0 2px 8px rgba(0,0,0,0.28)',
  md: '0 8px 24px rgba(0,0,0,0.35)',
  lg: '0 18px 44px rgba(0,0,0,0.45)',
  glow: '0 0 0 3px rgba(201,169,97,0.22)',
};

// Gold focus ring for keyboard + click focus on inputs/controls.
export const focusRing = `0 0 0 3px rgba(201,169,97,0.28)`;

export const ease = 'cubic-bezier(0.16, 1, 0.3, 1)';
