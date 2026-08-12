import { useNowTicker } from '../../hooks/useNowTicker.js';
import { useTvDailySettings } from '../../hooks/useTvDailySettings.js';
import TvStandardLayout from './TvStandardLayout.jsx';

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

  return <TvStandardLayout settings={settings} now={now} />;
}
