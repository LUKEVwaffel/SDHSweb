import TvRangeScreenBase from './TvRangeScreenBase.jsx';
import TvRangeCountdown from './TvRangeCountdown.jsx';

export default function TvRangePlanningScreen({ config, bell }) {
  return (
    <TvRangeScreenBase kicker="1ST PERIOD" title={config?.planning_message || 'Enjoy your Planning period'}>
      <TvRangeCountdown bell={bell} />
    </TvRangeScreenBase>
  );
}
