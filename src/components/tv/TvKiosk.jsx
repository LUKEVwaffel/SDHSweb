import { useNowTicker } from '../../hooks/useNowTicker.js';
import { useTvDailySettings } from '../../hooks/useTvDailySettings.js';
import { useStayAwake } from '../../hooks/useStayAwake.js';
import TvStandardLayout from './TvStandardLayout.jsx';
import TvRaftingScreen from './TvRaftingScreen.jsx';
import TvPreviewBadge from './TvPreviewBadge.jsx';
import TvRefreshNotice from './TvRefreshNotice.jsx';

// Temporary override: the kiosk shows the rafting-trip photo takeover instead
// of the normal rotation. Flip TAKEOVER_MODE to false (or delete the branch)
// to restore TvStandardLayout. `settings`/`now` stay wired so the revert is a
// one-line change.
const TAKEOVER_MODE = true;

/**
 * Outside — the original public kiosk, mounted at /tv. Thin per-screen
 * wrapper: fetches its own tv_daily_settings row ('default') and hands it to
 * the shared rotation layout. See TvStandardLayout.jsx for the actual
 * carousel/clock/weather/shoutouts/bottom-widget composition — that piece is
 * now shared with Range's rotation phase, not duplicated per screen.
 *
 * useStayAwake() runs the kiosk anti-sleep layers (Screen Wake Lock + a
 * playing hidden <video> + synthetic activity) so the wall-mounted display PC
 * stops dozing off the way it does on the plain web kiosk but never does
 * during a PowerPoint slideshow.
 */
export default function TvKiosk() {
  const now = useNowTicker();
  const { settings } = useTvDailySettings('default');
  useStayAwake();

  return (
    <>
      {TAKEOVER_MODE ? (
        <TvRaftingScreen />
      ) : (
        <TvStandardLayout settings={settings} now={now} />
      )}
      <TvPreviewBadge />
      <TvRefreshNotice />
    </>
  );
}
