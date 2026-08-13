import TvRangeScreenBase from './TvRangeScreenBase.jsx';
import TvRangePeriodProgressBar from './TvRangePeriodProgressBar.jsx';

// Item 4: progress bar instead of a bare countdown number — Planning is
// excluded from the last-5-min override (see NO_ENDING_WARNING_PERIODS in
// tvRangeSchedule.js), so this screen owns its own full-period visual.
export default function TvRangePlanningScreen({ config, bell, now }) {
  return (
    <TvRangeScreenBase kicker="1ST PERIOD" title={config?.planning_message || 'Enjoy your Planning period'}>
      {bell?.current && (
        <TvRangePeriodProgressBar period={bell.current} now={now} label="PLANNING PERIOD" />
      )}
    </TvRangeScreenBase>
  );
}
