import { useTvNotices } from '../../../hooks/useTvNotices.js';
import { useTvUpcomingEvents } from '../../../hooks/useTvUpcomingEvents.js';
import TvRangeSlideshowScreen from './TvRangeSlideshowScreen.jsx';
import { DEFAULT_SLIDESHOW } from './slides/slideRegistry.js';

// Range's rotation phase (the TBD content shown whenever no bell-driven
// phase is active) is a single admin-ordered slideshow —
// settings.range_schedule_config.slideshow_slides, built/reordered in
// StepRangeSlideshow.jsx — cycling one full-screen slide at a time. Used to
// also offer a freeform "Grid Layout" mode (everything at once on one
// board); that option's gone now, so this always renders the slideshow.
// Falls back to the seeded default playlist whenever the stored list is
// empty (a screen that predates the slideshow-only cutover, or was never
// configured), so a kiosk never just goes blank.
export default function TvRangeRotationLayout({ settings, config }) {
  const { notices } = useTvNotices('range');
  const events = useTvUpcomingEvents(6);

  const slides = config?.slideshow_slides?.length ? config.slideshow_slides : DEFAULT_SLIDESHOW;

  return (
    <TvRangeSlideshowScreen
      slides={slides}
      announcements={notices.filter((n) => n.category === 'announcement')}
      staffNotes={notices.filter((n) => n.category === 'staff_note')}
      events={events}
      settings={settings}
      rangeConfig={config}
    />
  );
}
