// Shared palette + tokens for /creed — mirrors the constants in
// CadetManual.jsx / TopNav.jsx so this page reads as part of the same site,
// not a bolted-on tool.
export const P = {
  ink: '#06101F',
  navy: '#142847',
  navyDeep: '#0A1628',
  gold: '#C9A961',
  goldBright: '#E8C77A',
  cream: '#F4ECD8',
  paper: '#EFE6CC',
  red: '#B23B2C',
  mute: 'rgba(244,236,216,0.6)',
  hairline: 'rgba(201,169,97,0.25)',
  hairlineStrong: 'rgba(201,169,97,0.55)',
  correct: '#5FA463',
  correctBg: 'rgba(95,164,99,0.14)',
  wrongBg: 'rgba(178,59,44,0.16)',
};

export const MONO = "'JetBrains Mono', monospace";
export const DISPLAY = 'Oswald, sans-serif';
export const BODY = 'Inter, sans-serif';

export const MASTERY_LABEL = {
  NOT_STARTED: 'NOT STARTED',
  IN_PROGRESS: 'IN PROGRESS',
  MASTERED: 'MASTERED',
};

export const MASTERY_COLOR = {
  NOT_STARTED: 'rgba(244,236,216,0.35)',
  IN_PROGRESS: P.gold,
  MASTERED: P.correct,
};
