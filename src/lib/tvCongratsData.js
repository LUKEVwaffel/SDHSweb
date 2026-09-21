// East Hamilton meet results — drives the /tv congrats takeover (TvCongratsScreen)
// and the OPTIC congrats popup (CongratsPopup). CONGRATS_PHOTOS is only the
// fallback shown while the live OPTIC feed (pinned to OPTIC_EVENT_ID) is empty;
// once that comp's photos are uploaded they take over automatically.

export const CONGRATS_MEET = {
  label: 'East Hamilton Raider Competition',
  date: 'September 19, 2026',
  kicker: '4 Podium Finishes',
  note: '',
};

// Ordered best-first. `tier` (1|2|3) drives the placement badge treatment.
export const CONGRATS_TROPHIES = [
  { tier: 1, place: '1st', event: 'Hurricane Hill', detail: 'Co-Ed Team' },
  { tier: 3, place: '3rd', event: 'Hurricane Hill', detail: 'Male Team' },
  { tier: 3, place: '3rd', event: 'One Rope Bridge', detail: 'Co-Ed Team' },
  { tier: 3, place: '3rd', event: 'One Rope Bridge', detail: 'Male Team' },
];

export const CONGRATS_PHOTOS = [
  { src: '', alt: 'East Hamilton — Hurricane Hill', title: 'Hurricane Hill' },
  { src: '', alt: 'East Hamilton — One Rope Bridge', title: 'One Rope Bridge' },
  { src: '', alt: 'East Hamilton — the team', title: 'Trojan Battalion' },
];
