import TvRangeScreenBase from './TvRangeScreenBase.jsx';
import TvRangeCountdown from './TvRangeCountdown.jsx';

export default function TvRangeT2Screen({ config, bell, now }) {
  return (
    <TvRangeScreenBase kicker="T2 BLOCK" title={config?.t2_message || "It's T2 time"}>
      {bell?.current && (
        <TvRangeCountdown target={bell.current.end} now={now} sub={bell.next.name} />
      )}
    </TvRangeScreenBase>
  );
}
