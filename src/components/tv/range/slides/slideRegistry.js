// Companies eligible for a Packets Due slide (SLIDE_TYPES.packetsDue below)
// — staff gets its own copy on the Staff schedule screen instead of a
// rotation slide, so it's deliberately left out of this list.
export const PACKET_DUE_COMPANIES = [
  { id: 'alpha', label: 'Alpha' },
  { id: 'bravo', label: 'Bravo' },
  { id: 'charlie', label: 'Charlie' },
  { id: 'delta', label: 'Delta' },
];

// Catalog of full-screen slide templates for Range's rotation screen
// (StepRangeSlideshow.jsx builds the "+ Add Slide" gallery from this; the
// live kiosk (TvRangeSlideshowScreen.jsx) resolves `type` to a component
// from the same map) — one source, admin + kiosk both read it.
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
  staffNotes: {
    label: 'Notes From Staff',
    blurb: 'Every posted staff note, listed full-screen — same content as the Staff Notes tab.',
    defaultDurationSec: 15,
    defaultConfig: {},
  },
  upcomingEvents: {
    label: 'Upcoming Events',
    blurb: 'What’s next on the calendar, soonest first.',
    defaultDurationSec: 15,
    defaultConfig: {},
  },
  photoOfDay: {
    label: 'Photo Carousel',
    blurb: 'Rotating photos from this screen’s Photo Source setting.',
    defaultDurationSec: 20,
    defaultConfig: {},
  },
  raiderPractice: {
    label: 'Raider Practice',
    blurb: 'Practice days/times, report-to, what to bring — plus a GroupMe QR if one’s set below.',
    defaultDurationSec: 15,
    defaultConfig: {},
  },
  packetsDue: {
    label: 'Packets Due Reminder',
    blurb: 'Reminder that DD Form 3203 + the JROTC Datasheet are due, with cadets from one company still missing them — add one per company below.',
    defaultDurationSec: 15,
    defaultConfig: { company: PACKET_DUE_COMPANIES[0].id },
  },
  raiderCongrats: {
    label: 'Raider Team Congrats',
    blurb: 'Full-screen Rhea County podium takeover with the live OPTIC photo carousel — the same board /tv shows.',
    defaultDurationSec: 30,
    defaultConfig: {},
  },
};

// No legacy slide-type remaps in play right now. `raiderCongrats` was once
// aliased to `packetsDue`; that alias is gone now that the Raider Team
// Congrats slide is a real type again, so any screen still saved with
// `raiderCongrats` resolves straight to the restored slide.
const LEGACY_SLIDE_TYPE_ALIASES = {};
export function resolveSlideType(type) {
  return LEGACY_SLIDE_TYPE_ALIASES[type] || type;
}

export function makeSlide(type, configOverride) {
  const def = SLIDE_TYPES[type];
  return {
    id: crypto.randomUUID(),
    type,
    durationSec: def.defaultDurationSec,
    config: { ...def.defaultConfig, ...configOverride },
  };
}

// Seeded the first time an admin switches a screen into Slideshow mode, so
// the TV never goes blank mid-switch waiting on someone to build a playlist
// from scratch. One packetsDue slide per company (not one battalion-wide
// slide) so every company sees only their own outstanding names on rotation.
export const DEFAULT_SLIDESHOW = [
  makeSlide('announcements'),
  makeSlide('uniformCountdown'),
  makeSlide('announcementSingle'),
  ...PACKET_DUE_COMPANIES.map((c) => makeSlide('packetsDue', { company: c.id })),
];
