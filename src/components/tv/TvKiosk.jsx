import { useNowTicker } from '../../hooks/useNowTicker.js';
import { useTvDailySettings } from '../../hooks/useTvDailySettings.js';
import TvStandardLayout from './TvStandardLayout.jsx';
import TvCongratsScreen from './TvCongratsScreen.jsx';
import TvPreviewBadge from './TvPreviewBadge.jsx';
import TvRefreshNotice from './TvRefreshNotice.jsx';

// Temporary override: after the Rhea County meet the kiosk shows the congrats
// takeover instead of the normal rotation. Flip CONGRATS_MODE to false (or
// delete the branch) to restore TvStandardLayout. `settings`/`now` stay wired
// so the revert is a one-line change.
const CONGRATS_MODE = true;

/**
 * Outside — the original public kiosk, mounted at /tv. Thin per-screen
 * wrapper: fetches its own tv_daily_settings row ('default') and hands it to
 * the shared rotation layout. See TvStandardLayout.jsx for the actual
 * carousel/clock/weather/shoutouts/bottom-widget composition — that piece is
 * now shared with Range's rotation phase, not duplicated per screen.
 */
export default function TvKiosk() {
  const now = useNowTicker();
  const { settings } = useTvDailySettings('default');

  return (
    <>
      {CONGRATS_MODE ? (
        <TvCongratsScreen />
      ) : (
        <TvStandardLayout settings={settings} now={now} />
      )}
      <TvPreviewBadge />
      <TvRefreshNotice />
    </>
  );
}
