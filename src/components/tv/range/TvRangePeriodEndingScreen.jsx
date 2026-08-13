import { renderTemplate } from '../../../lib/tvRangeSchedule.js';
import TvRangeScreenBase from './TvRangeScreenBase.jsx';
import TvRangeCountdown from './TvRangeCountdown.jsx';

// Item 1: last-5-minutes warning. Overrides whatever phase would otherwise be
// showing (company-welcome, rotation, T2, etc — see the priority check in
// getRangePhase()) for every period except Planning/Staff, which keep their
// own screens per product decision. Shows the company (when this period has
// one) or the bare period name, plus a countdown straight to the bell.
export default function TvRangePeriodEndingScreen({ config, company, periodName, bell, now }) {
  const title = company
    ? renderTemplate(config?.company_welcome_template || 'Welcome {company} Company', { company })
    : periodName;

  return (
    <TvRangeScreenBase kicker="WRAPPING UP" title={title}>
      <TvRangeCountdown kicker="BELL IN" target={bell?.current?.end} now={now} />
    </TvRangeScreenBase>
  );
}
