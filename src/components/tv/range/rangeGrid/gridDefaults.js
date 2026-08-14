// Widget catalog + starting layout for Range's freeform rotation-screen grid
// (RangeGridBoard.jsx). One entry per kind — id doubles as kind since each
// widget appears at most once on the board. Coordinates are 0..1 fractions
// of the canvas, matching the drag/resize math in RangeGridBoard.jsx.
// Kinds that render edge-to-edge (own crop/overflow handling) rather than
// inside the board's standard padded tile body.
export const GRID_WIDGET_FILL_KINDS = new Set(['photo']);

export const GRID_WIDGET_LABELS = {
  clock: 'BELL SCHEDULE',
  weather: 'WEATHER',
  photo: 'PHOTO OF THE DAY',
  announcements: 'ANNOUNCEMENTS',
  events: 'UPCOMING EVENTS',
  staffnotes: 'NOTES FROM STAFF',
  raider: 'RAIDER PRACTICE',
  bottomWidget: 'BOTTOM WIDGET',
  shoutouts: 'SHOUTOUTS',
};

export const DEFAULT_ROTATION_GRID = [
  { id: 'clock', kind: 'clock', x: 0, y: 0, w: 0.34, h: 0.5, visible: true },
  { id: 'weather', kind: 'weather', x: 0.34, y: 0, w: 0.16, h: 0.5, visible: true },
  { id: 'photo', kind: 'photo', x: 0.5, y: 0, w: 0.25, h: 1, visible: true },
  { id: 'announcements', kind: 'announcements', x: 0.75, y: 0, w: 0.25, h: 0.5, visible: true },
  { id: 'events', kind: 'events', x: 0.75, y: 0.5, w: 0.25, h: 0.5, visible: true },
  { id: 'staffnotes', kind: 'staffnotes', x: 0, y: 0.5, w: 0.34, h: 0.5, visible: true },
  { id: 'raider', kind: 'raider', x: 0.34, y: 0.5, w: 0.16, h: 0.5, visible: true },
  { id: 'bottomWidget', kind: 'bottomWidget', x: 0.02, y: 0.78, w: 0.3, h: 0.2, visible: false },
  { id: 'shoutouts', kind: 'shoutouts', x: 0.35, y: 0.78, w: 0.3, h: 0.2, visible: false },
];

// `raider` is only ever offered when Range's showRaiderPractice checkbox
// (StepRangeSchedule.jsx) is on — that checkbox stays the single on/off
// switch for the widget's existence; this board only ever controls its
// position/size/visibility among the other already-enabled widgets. Takes a
// plain boolean (not a config object) since the live kiosk's config is raw
// snake_case (`show_raider_practice`) while the admin draft is camelCase
// (`showRaiderPractice`) — callers normalize before calling in.
export function resolveRotationGrid(grid, showRaiderPractice) {
  const base = grid?.length ? grid : DEFAULT_ROTATION_GRID;
  if (showRaiderPractice) return base;
  return base.filter((w) => w.kind !== 'raider');
}
