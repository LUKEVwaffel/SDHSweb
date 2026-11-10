import { useNowTicker } from '../../hooks/useNowTicker.js';
import { useStayAwake } from '../../hooks/useStayAwake.js';
import TvServiceLearningScreen from './TvServiceLearningScreen.jsx';
import TvPreviewBadge from './TvPreviewBadge.jsx';
import TvRefreshNotice from './TvRefreshNotice.jsx';

/** Public /tv service-learning takeover. Keep wake lock and remote preview support. */
export default function TvKiosk() {
  const now = useNowTicker();
  useStayAwake();

  return (
    <>
      <TvServiceLearningScreen now={now} />
      <TvPreviewBadge />
      <TvRefreshNotice />
    </>
  );
}
