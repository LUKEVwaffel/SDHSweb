import { P, inter, sp } from '../../admin/theme.js';
import { useTvNotices } from '../../../hooks/useTvNotices.js';
import { useTvUpcomingEvents } from '../../../hooks/useTvUpcomingEvents.js';
import RangeGridBoard from './rangeGrid/RangeGridBoard.jsx';
import { resolveRotationGrid } from './rangeGrid/gridDefaults.js';

// Range's rotation phase (the TBD photo/widget content) is a freeform,
// staff-arranged widget board — position/size/visibility of every tile lives
// in settings.range_schedule_config.rotation_grid, edited from the "Grid
// Layout" tab in TV Remote (StepRangeLayout.jsx) via RangeGridBoard, the same
// component that renders it here read-only. Outside-only content
// (TvStandardLayout, still used by TvKiosk.jsx) is untouched — that includes
// TvCountdownBand, which used to be force-mounted here too; Range's "until
// next event" content is now the addable/movable `countdown` grid widget
// instead (RangeGridCountdown.jsx), not a fixed band.
export default function TvRangeRotationLayout({ settings, now, config }) {
  const { notices } = useTvNotices('range');
  const events = useTvUpcomingEvents(6);

  const grid = resolveRotationGrid(config?.rotation_grid, !!config?.show_raider_practice);

  const contentProps = {
    settings, now, config,
    announcements: notices.filter((n) => n.category === 'announcement'),
    staffNotes: notices.filter((n) => n.category === 'staff_note'),
    events,
  };

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
