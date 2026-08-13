// Shared static content for Raiders' standing practice info — Raiders.jsx's
// "JOIN THE TEAM" section and the Range TV Raider Practice widget
// (TvRangeRaiderPracticeWidget.jsx) both pull from here so the two surfaces
// can't drift out of sync. Not DB-driven; update this file when the schedule
// changes.
export const RAIDER_PRACTICE_TILES = [
  { label: 'PRACTICES', value: 'MON – THU', sub: '2:30 PM – 4:30 PM' },
  { label: 'REPORT TO', value: 'THE RANGE' },
  { label: 'BRING', value: 'WATER + PT CLOTHES' },
];
