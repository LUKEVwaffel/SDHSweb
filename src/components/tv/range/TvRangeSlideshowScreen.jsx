import { useState, useEffect, useRef, useCallback } from 'react';
import SlideAnnouncements from './slides/SlideAnnouncements.jsx';
import SlideAnnouncementSingle from './slides/SlideAnnouncementSingle.jsx';
import SlideUniformCountdown from './slides/SlideUniformCountdown.jsx';
import SlideEventSpotlight from './slides/SlideEventSpotlight.jsx';
import SlideStaffNotes from './slides/SlideStaffNotes.jsx';
import SlideUpcomingEvents from './slides/SlideUpcomingEvents.jsx';
import SlidePhotoOfDay from './slides/SlidePhotoOfDay.jsx';
import SlideRaiderPractice from './slides/SlideRaiderPractice.jsx';
import SlideRaiderCongrats from './slides/SlideRaiderCongrats.jsx';

const SLIDE_COMPONENTS = {
  announcements: SlideAnnouncements,
  announcementSingle: SlideAnnouncementSingle,
  uniformCountdown: SlideUniformCountdown,
  eventSpotlight: SlideEventSpotlight,
  staffNotes: SlideStaffNotes,
  upcomingEvents: SlideUpcomingEvents,
  photoOfDay: SlidePhotoOfDay,
  raiderPractice: SlideRaiderPractice,
  raiderCongrats: SlideRaiderCongrats,
};

// Fades through black between slides rather than a hard cut — opacity only
// (compositor-friendly), no cross-render of two slides at once.
const FADE_MS = 500;
const MIN_DURATION_SEC = 3;

/**
 * Range's Slideshow rotation — cycles admin-ordered full-screen slides one
 * at a time (TvRangeRotationLayout.jsx is the only caller on the live
 * kiosk; StepRangeSlideshow.jsx also mounts this for TV Preview). `slides`
 * is `range_schedule_config.slideshow_slides`, built/reordered in
 * StepRangeSlideshow.jsx. `announcements`/`staffNotes`/`events`/`settings`/
 * `rangeConfig` are all fetched once by the caller and passed straight
 * through to whichever slide needs them, rather than re-fetched per slide —
 * useTvNotices in particular opens a Supabase realtime channel keyed by
 * screen slug, and a second simultaneous subscribe to the same slug throws.
 *
 * A slide reports back via `onEmpty` once it knows it has nothing real to
 * show (zero announcements, a never-filled-in single announcement, an
 * inactive event spotlight, …) — the rotation skips straight to the next
 * slide instead of burning that slide's full durationSec on a blank
 * placeholder. Skips are capped at one full pass through the playlist so a
 * completely unconfigured slideshow can't spin in place forever; it just
 * settles on whatever's current and waits out its normal timer.
 */
export default function TvRangeSlideshowScreen({ slides, announcements, staffNotes, events, settings, rangeConfig }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const emptySkipStreakRef = useRef(0);

  // Keeps the kiosk from pointing past the end if an admin removes slides
  // live while this screen is already running.
  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  const advance = useCallback(() => {
    setIndex((i) => (slides.length ? (i + 1) % slides.length : 0));
    setVisible(true);
  }, [slides.length]);

  const prevSlidesRef = useRef(slides);
  if (prevSlidesRef.current !== slides) {
    console.log('[SLIDESHOW DEBUG] slides identity CHANGED', prevSlidesRef.current === slides);
    prevSlidesRef.current = slides;
  }

  useEffect(() => {
    console.log('[SLIDESHOW DEBUG] duration effect (re)armed for index', index, 'at', Date.now());
    if (slides.length <= 1) return undefined;
    const durationMs = Math.max(MIN_DURATION_SEC, slides[index]?.durationSec ?? MIN_DURATION_SEC) * 1000;
    const fadeTimer = setTimeout(() => setVisible(false), Math.max(0, durationMs - FADE_MS));
    const advanceTimer = setTimeout(() => {
      console.log('[SLIDESHOW DEBUG] advanceTimer FIRED for index', index, 'at', Date.now());
      emptySkipStreakRef.current = 0;
      advance();
    }, durationMs);
    return () => { console.log('[SLIDESHOW DEBUG] duration effect cleanup for index', index, 'at', Date.now()); clearTimeout(fadeTimer); clearTimeout(advanceTimer); };
  }, [index, slides, advance]);

  const slide = slides[index];

  const handleEmpty = useCallback(() => {
    if (slides.length <= 1) return;
    if (emptySkipStreakRef.current >= slides.length) return; // everything looks empty — stop skipping, just sit here
    emptySkipStreakRef.current += 1;
    advance();
  }, [slides.length, advance]);

  const SlideComponent = slide && SLIDE_COMPONENTS[slide.type];
  if (!SlideComponent) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, opacity: visible ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` }}>
      <SlideComponent
        announcements={announcements}
        staffNotes={staffNotes}
        events={events}
        settings={settings}
        rangeConfig={rangeConfig}
        style={slide.config?.style}
        config={slide.config}
        onEmpty={handleEmpty}
      />
    </div>
  );
}
