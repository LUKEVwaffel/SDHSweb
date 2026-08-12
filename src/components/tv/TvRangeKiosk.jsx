import { useNowTicker } from '../../hooks/useNowTicker.js';
import { useTvDailySettings } from '../../hooks/useTvDailySettings.js';
import { getRangePhase } from '../../lib/tvRangeSchedule.js';
import TvStandardLayout from './TvStandardLayout.jsx';
import TvRangePlanningScreen from './range/TvRangePlanningScreen.jsx';
import TvRangeT2Screen from './range/TvRangeT2Screen.jsx';
import TvRangeCompanyWelcomeScreen from './range/TvRangeCompanyWelcomeScreen.jsx';
import TvRangeLunchScreen from './range/TvRangeLunchScreen.jsx';
import TvRangeStaffScheduleScreen from './range/TvRangeStaffScheduleScreen.jsx';
import TvRangeOffHoursScreen from './range/TvRangeOffHoursScreen.jsx';

/**
 * Range — /tv/range. Unlike Outside (TvKiosk.jsx, a single fixed layout),
 * Range's content is period-driven: getRangePhase() reads the same bell
 * schedule Outside's clock/bell widget uses (settings.bell_schedule,
 * Normal/T2) plus this screen's own range_schedule_config, and picks which
 * fullscreen phase to show. 'rotation' is the one phase that isn't a
 * dedicated screen — it reuses TvStandardLayout (Outside's carousel +
 * instrument column), fed by Range's own tv_daily_settings row, so the
 * "content TBD later" portions of each period are controllable today from
 * TV Remote's existing tabs rather than a placeholder.
 */
export default function TvRangeKiosk() {
  const now = useNowTicker();
  const { settings } = useTvDailySettings('range');

  const scheduleKey = settings?.bell_schedule ?? 'normal';
  const config = settings?.range_schedule_config ?? null;
  const result = getRangePhase(scheduleKey, now, config);

  switch (result.phase) {
    case 'planning':
      return <TvRangePlanningScreen config={config} bell={result.bell} />;
    case 't2':
      return <TvRangeT2Screen config={config} bell={result.bell} />;
    case 'staff-schedule':
      return <TvRangeStaffScheduleScreen scheduleKey={scheduleKey} bell={result.bell} />;
    case 'lunch1':
      return <TvRangeLunchScreen config={config} minutesUntilLunchEnd={result.minutesUntilLunchEnd} />;
    case 'company-welcome':
      return <TvRangeCompanyWelcomeScreen config={config} company={result.company} />;
    case 'off-hours':
      return <TvRangeOffHoursScreen stage={result.stage} bell={result.bell} />;
    case 'rotation':
    default:
      return <TvStandardLayout settings={settings} now={now} />;
  }
}
