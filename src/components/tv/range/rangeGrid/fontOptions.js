import { inter, oswald, fraunces, mono } from '../../../admin/theme.js';

// Site's 4 self-hosted families only (src/index.css @font-face) — no new
// fonts loaded for this. Values are the same CSS stacks theme.js exports.
// Used by StepRangeSlideshow.jsx's per-slide font picker (announcements /
// staff notes / raider practice slides all take a style.fontFamily override).
export const FONT_FAMILY_OPTIONS = [
  { key: 'inter', label: 'Inter', value: inter },
  { key: 'oswald', label: 'Oswald', value: oswald },
  { key: 'fraunces', label: 'Fraunces', value: fraunces },
  { key: 'mono', label: 'JetBrains Mono', value: mono },
];
