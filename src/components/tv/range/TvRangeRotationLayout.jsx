import { P, inter, sp } from '../../admin/theme.js';
import { useTvNotices } from '../../../hooks/useTvNotices.js';
import { useTvUpcomingEvents } from '../../../hooks/useTvUpcomingEvents.js';
import RangeGridBoard from './rangeGrid/RangeGridBoard.jsx';
import { resolveRotationGrid } from './rangeGrid/gridDefaults.js';
import TvRangeSlideshowScreen from './TvRangeSlideshowScreen.jsx';

// Range's rotation phase (the TBD photo/widget content) has two modes,
// chosen per-screen from the "Rotation Screen" tab in TV Remote
// (StepRotationScreen.jsx) and stored as `rotation_mode`:
//   - 'grid' (default, backward-compatible with every screen predating this
//     toggle): the freeform, staff-arranged widget board below — position/
//     size/visibility of every tile lives in
//     settings.range_schedule_config.rotation_grid, edited via
//     RangeGridBoard, the same component that renders it here read-only.
//   - 'slideshow': cycles full-screen single-purpose slides
//     (`slideshow_slides`, edited in StepRangeSlideshow.jsx) one at a time —
//     for when the grid's "everything at once" density is more than cadets
//     can read from across the room during a period.
// Falls back to the grid whenever slideshow mode has zero slides, so a
// half-configured screen never just goes blank. Outside-only content
// (TvStandardLayout, still used by TvKiosk.jsx) is untouched — that includes
// TvCountdownBand, which used to be force-mounted here too; Range's "until
// next event" content is now the addable/movable `countdown` grid widget
// instead (RangeGridCountdown.jsx), not a fixed band.
export default function TvRangeRotationLayout({ settings, now, config }) {
  const { notices } = useTvNotices('range');
  const events = useTvUpcomingEvents(6);

  const slides = config?.slideshow_slides ?? [];
  const useSlideshow = config?.rotation_mode === 'slideshow' && slides.length > 0;

  const grid = resolveRotationGrid(config?.rotation_grid, !!config?.show_raider_practice);

  const contentProps = {
    settings, now, config,
    announcements: notices.filter((n) => n.category === 'announcement'),
    staffNotes: notices.filter((n) => n.category === 'staff_note'),
    events,
  };

  if (useSlideshow) {
    return <TvRangeSlideshowScreen slides={slides} announcements={contentProps.announcements} />;
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink,
      display: 'flex', flexDirection: 'column', fontFamily: inter,
    }}>
      {/* Bottom padding clears TvRangeClock (fixed bottom-right, ~50px tall,
          rendered by TvRangeKiosk.jsx above every phase screen) — without it
          a tile whose freeform placement runs to the bottom edge visually
          collides with it. */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', paddingBottom: sp[16] }}>
        <RangeGridBoard grid={grid} editable={false} fullBleed onChange={() => {}} contentProps={contentProps} />
      </div>
    </div>
  );
}
