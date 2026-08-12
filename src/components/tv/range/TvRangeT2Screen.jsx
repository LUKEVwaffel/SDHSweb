import TvRangeScreenBase from './TvRangeScreenBase.jsx';
import TvRangeCountdown from './TvRangeCountdown.jsx';

export default function TvRangeT2Screen({ config, bell }) {
  return (
    <TvRangeScreenBase kicker="T2 BLOCK" title={config?.t2_message || "It's T2 time"}>
      <TvRangeCountdown bell={bell} />
    </TvRangeScreenBase>
  );
}
