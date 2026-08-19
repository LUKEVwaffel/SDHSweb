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
import TvPreviewBadge from './TvPreviewBadge.jsx';
import TvRefreshNotice from './TvRefreshNotice.jsx';
import TvRangeClock from './TvRangeClock.jsx';

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

  let phaseContent;
  switch (result.phase) {
    case 'planning':
      phaseContent = <TvRangePlanningScreen config={config} bell={result.bell} now={now} scheduleKey={scheduleKey} />;
      break;
    case 't2':
      phaseContent = <TvRangeT2Screen config={config} bell={result.bell} now={now} />;
      break;
    case 'staff-schedule':
      phaseContent = <TvRangeStaffScheduleScreen scheduleKey={scheduleKey} bell={result.bell} now={now} />;
      break;
    case 'lunch1':
      phaseContent = <TvRangeLunchScreen config={config} lunchEndTime={result.lunchEndTime} now={now} />;
      break;
    case 'company-welcome':
      phaseContent = <TvRangeCompanyWelcomeScreen config={config} company={result.company} now={now} scheduleKey={scheduleKey} />;
      break;
    case 'period-ending':
      phaseContent = <TvRangePeriodEndingScreen config={config} company={result.company} periodName={result.periodName} bell={result.bell} now={now} />;
      break;
    case 'off-hours':
      phaseContent = <TvRangeOffHoursScreen stage={result.stage} bell={result.bell} now={now} />;
      break;
    case 'rotation':
    default:
      phaseContent = <TvRangeRotationLayout settings={settings} now={now} config={config} />;
  }

  return (
    <>
      {phaseContent}
      <TvRangeClock now={now} />
      <TvPreviewBadge />
      <TvRefreshNotice />
    </>
  );
}
