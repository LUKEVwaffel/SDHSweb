import { useNowTicker } from '../../hooks/useNowTicker.js';
import { useTvDailySettings } from '../../hooks/useTvDailySettings.js';
import { getRangePhase } from '../../lib/tvRangeSchedule.js';
import TvRangePlanningScreen from './range/TvRangePlanningScreen.jsx';
import TvRangeT2Screen from './range/TvRangeT2Screen.jsx';
import TvRangeCompanyWelcomeScreen from './range/TvRangeCompanyWelcomeScreen.jsx';
import TvRangeLunchScreen from './range/TvRangeLunchScreen.jsx';
import TvRangeStaffScheduleScreen from './range/TvRangeStaffScheduleScreen.jsx';
import TvRangeOffHoursScreen from './range/TvRangeOffHoursScreen.jsx';
import TvRangePeriodEndingScreen from './range/TvRangePeriodEndingScreen.jsx';
import TvRangeRotationLayout from './range/TvRangeRotationLayout.jsx';

/**
 * Range — /tv/range. Unlike Outside (TvKiosk.jsx, a single fixed layout),
 * Range's content is period-driven: getRangePhase() reads the same bell
 * schedule Outside's clock/bell widget uses (settings.bell_schedule,
 * Normal/T2) plus this screen's own range_schedule_config, and picks which
 * fullscreen phase to show. 'rotation' is Range's own 3-panel Announcements /
 * Upcoming Events / Notes from Staff layout (TvRangeRotationLayout.jsx) — a
 * dedicated Range-only replacement for the old TvStandardLayout reuse; Outside
 * (TvKiosk.jsx) still renders TvStandardLayout unchanged.
 */
export default function TvRangeKiosk() {
  const now = useNowTicker();
  const { settings } = useTvDailySettings('range');

  const scheduleKey = settings?.bell_schedule ?? 'normal';
  const config = settings?.range_schedule_config ?? null;
  const result = getRangePhase(scheduleKey, now, config);

  switch (result.phase) {
    case 'planning':
      return <TvRangePlanningScreen config={config} bell={result.bell} now={now} />;
    case 't2':
      return <TvRangeT2Screen config={config} bell={result.bell} now={now} />;
    case 'staff-schedule':
      return <TvRangeStaffScheduleScreen scheduleKey={scheduleKey} bell={result.bell} now={now} />;
    case 'lunch1':
      return <TvRangeLunchScreen config={config} lunchEndTime={result.lunchEndTime} now={now} />;
    case 'company-welcome':
      return <TvRangeCompanyWelcomeScreen config={config} company={result.company} />;
    case 'period-ending':
      return <TvRangePeriodEndingScreen config={config} company={result.company} periodName={result.periodName} bell={result.bell} now={now} />;
    case 'off-hours':
      return <TvRangeOffHoursScreen stage={result.stage} bell={result.bell} now={now} />;
    case 'rotation':
    default:
      return <TvRangeRotationLayout settings={settings} now={now} />;
  }
}
