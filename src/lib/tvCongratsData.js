// Rhea County meet results — drives the /tv congrats takeover (TvCongratsScreen).
// When this meet's photos are ready, fill in each CONGRATS_PHOTOS `src`
// (public-folder path or remote URL); an empty `src` renders the carousel's
// built-in "AWAITING PHOTO" placeholder, so the screen is presentable now.

export const CONGRATS_MEET = {
  label: 'Rhea County Raider Meet',
  date: 'August 29, 2026',
  kicker: '5 Podium Finishes',
};

// Ordered best-first. `tier` (1|2|3) drives the placement badge treatment.
export const CONGRATS_TROPHIES = [
  { tier: 1, place: '1st', event: 'Cross Country Rescue', detail: 'Co-Ed Team' },
  { tier: 2, place: '2nd', event: 'Overall Male Division', detail: 'Team Standing' },
  { tier: 2, place: '2nd', event: 'Cross Country Rescue', detail: 'Male Team' },
  { tier: 2, place: '2nd', event: 'Tire Stacker', detail: 'Male Team' },
  { tier: 3, place: '3rd', event: 'One Rope Bridge', detail: 'Male Team · 1:44' },
];

export const CONGRATS_PHOTOS = [
  { src: '', alt: 'Rhea County — Cross Country Rescue', title: 'Cross Country Rescue' },
  { src: '', alt: 'Rhea County — Overall Male Division', title: 'Overall Male Division' },
  { src: '', alt: 'Rhea County — One Rope Bridge', title: 'One Rope Bridge' },
  { src: '', alt: 'Rhea County — Tire Stacker', title: 'Tire Stacker' },
  { src: '', alt: 'Rhea County — the team', title: 'Trojan Battalion' },
];
