import TvRangeScreenBase from './TvRangeScreenBase.jsx';
import TvRangeCountdown from './TvRangeCountdown.jsx';

export default function TvRangePlanningScreen({ config, bell }) {
  return (
    <TvRangeScreenBase kicker="1ST PERIOD" title={config?.planning_message || 'Enjoy your Planning period'}>
      {bell && !bell.done && (
        <TvRangeCountdown minutesUntil={bell.minutesUntil} sub={bell.next.name} />
      )}
    </TvRangeScreenBase>
  );
}
