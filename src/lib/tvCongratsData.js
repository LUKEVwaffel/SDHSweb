// Spring Hill meet results — drives the /tv congrats takeover (TvCongratsScreen)
// and the OPTIC congrats popup (CongratsPopup). When this meet's photos are
// ready, fill in each CONGRATS_PHOTOS `src` (public-folder path or remote URL);
// an empty `src` renders the carousel's built-in "AWAITING PHOTO" placeholder,
// so the screen is presentable now.

export const CONGRATS_MEET = {
  label: 'Spring Hill Raider Competition',
  date: 'September 12, 2026',
  kicker: '4 Podium Finishes',
  // Co-Ed's commander went down before the comp; the JV commander stepped up
  // and still brought home the OC win.
  note: 'Co-Ed led by JV Commander Hayden Ogle after a Zoe injury',
};

// Ordered best-first. `tier` (1|2|3) drives the placement badge treatment.
export const CONGRATS_TROPHIES = [
  { tier: 1, place: '1st', event: 'Obstacle Course', detail: 'Co-Ed Team' },
  { tier: 2, place: '2nd', event: 'One Rope Bridge', detail: 'Male Team' },
  { tier: 3, place: '3rd', event: 'Overall Male Division', detail: 'Team Standing' },
  { tier: 3, place: '3rd', event: 'Physical Team Test (PTT)', detail: 'Male Team' },
];

export const CONGRATS_PHOTOS = [
  { src: '', alt: 'Spring Hill — Obstacle Course', title: 'Obstacle Course' },
  { src: '', alt: 'Spring Hill — One Rope Bridge', title: 'One Rope Bridge' },
  { src: '', alt: 'Spring Hill — Overall Male Division', title: 'Overall Male Division' },
  { src: '', alt: 'Spring Hill — Physical Team Test', title: 'Physical Team Test' },
  { src: '', alt: 'Spring Hill — the team', title: 'Trojan Battalion' },
];
