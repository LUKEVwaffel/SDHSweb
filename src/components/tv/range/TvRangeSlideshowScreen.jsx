import { useState, useEffect } from 'react';
import SlideAnnouncements from './slides/SlideAnnouncements.jsx';
import SlideAnnouncementSingle from './slides/SlideAnnouncementSingle.jsx';
import SlideUniformCountdown from './slides/SlideUniformCountdown.jsx';

const SLIDE_COMPONENTS = {
  announcements: SlideAnnouncements,
  announcementSingle: SlideAnnouncementSingle,
  uniformCountdown: SlideUniformCountdown,
};

// Fades through black between slides rather than a hard cut — opacity only
// (compositor-friendly), no cross-render of two slides at once.
const FADE_MS = 500;
const MIN_DURATION_SEC = 3;

/**
 * Range's Slideshow rotation mode — cycles admin-ordered full-screen slides
 * one at a time instead of the Grid Layout mode's single packed board
 * (TvRangeRotationLayout.jsx picks between the two off `rotation_mode`).
 * `slides` is `range_schedule_config.slideshow_slides`, built/reordered in
 * StepRangeSlideshow.jsx. `announcements` is passed in by the caller
 * (TvRangeRotationLayout.jsx on the live kiosk, StepRangeSlideshow.jsx for
 * TV Preview) rather than fetched here — useTvNotices opens a Supabase
 * realtime channel keyed by screen slug, and a second simultaneous call to
 * it for the same slug reuses the same channel object mid-subscribe and
 * throws ("cannot add postgres_changes callbacks... after subscribe()"),
 * crashing the tree. Every caller here already has its own useTvNotices
 * call for other purposes, so this just reuses that single result.
 */
export default function TvRangeSlideshowScreen({ slides, announcements }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  // Keeps the kiosk from pointing past the end if an admin removes slides
  // live while this screen is already running.
  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const durationMs = Math.max(MIN_DURATION_SEC, slides[index]?.durationSec ?? MIN_DURATION_SEC) * 1000;
    const fadeTimer = setTimeout(() => setVisible(false), Math.max(0, durationMs - FADE_MS));
    const advanceTimer = setTimeout(() => {
      setIndex((i) => (i + 1) % slides.length);
      setVisible(true);
    }, durationMs);
    return () => { clearTimeout(fadeTimer); clearTimeout(advanceTimer); };
  }, [index, slides]);

  const slide = slides[index];
  const SlideComponent = slide && SLIDE_COMPONENTS[slide.type];
  if (!SlideComponent) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, opacity: visible ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` }}>
      <SlideComponent announcements={announcements} style={slide.config?.style} config={slide.config} />
    </div>
  );
}
