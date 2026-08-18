// Catalog of full-screen slide templates for Range's Slideshow rotation mode
// (StepRangeSlideshow.jsx builds the "+ Add Slide" gallery from this; the
// live kiosk (TvRangeSlideshowScreen.jsx) resolves `type` to a component
// from the same map) — same "one source, admin + kiosk both read it" shape
// gridDefaults.js already uses for the Grid Layout mode.
export const SLIDE_TYPES = {
  announcements: {
    label: 'Announcements',
    blurb: 'Every posted announcement, listed full-screen.',
    defaultDurationSec: 20,
    defaultConfig: {},
  },
  uniformCountdown: {
    label: 'Next Uniform Day',
    blurb: 'Next uniform day, plus a countdown to a chosen event.',
    defaultDurationSec: 15,
    defaultConfig: { countdownEventId: null },
  },
  announcementSingle: {
    label: 'Announcement (Single)',
    blurb: 'One message, shown big — written right here, separate from the Announcements tab.',
    defaultDurationSec: 12,
    defaultConfig: { title: '', message: '' },
  },
  eventSpotlight: {
    label: 'Event Spotlight',
    blurb: 'Beta test event photos + write-up — content is set in DISPATCH → Beta Features, not here.',
    defaultDurationSec: 20,
    defaultConfig: {},
  },
};

export function makeSlide(type) {
  const def = SLIDE_TYPES[type];
  return {
    id: crypto.randomUUID(),
    type,
    durationSec: def.defaultDurationSec,
    config: { ...def.defaultConfig },
  };
}

// Seeded the first time an admin switches a screen into Slideshow mode, so
// the TV never goes blank mid-switch waiting on someone to build a playlist
// from scratch.
export const DEFAULT_SLIDESHOW = [
  makeSlide('announcements'),
  makeSlide('uniformCountdown'),
  makeSlide('announcementSingle'),
];
