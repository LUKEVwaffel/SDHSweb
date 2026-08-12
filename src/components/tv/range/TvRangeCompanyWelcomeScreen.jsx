import { P, mono, fs, sp } from '../../admin/theme.js';
import { renderTemplate } from '../../../lib/tvRangeSchedule.js';
import TvRangeScreenBase from './TvRangeScreenBase.jsx';

// 2nd/4th(post-lunch)/5th/6th period welcome — intentionally the sparsest
// screen in the set ("nothing else, distraction-free" per spec): just the
// welcome line and the 1SGT attendance reminder, no countdown, no widgets.
export default function TvRangeCompanyWelcomeScreen({ config, company }) {
  const welcome = renderTemplate(config?.company_welcome_template || 'Welcome {company} Company', { company });
  const reminder = config?.attendance_reminder_template || '1SGT: Take attendance now';

  return (
    <TvRangeScreenBase title={welcome}>
      <div style={{
        marginTop: sp[4], padding: `${sp[3]}px ${sp[6]}px`, border: `1px solid ${P.hairStrong}`,
        borderRadius: 999, fontFamily: mono, fontSize: fs.md, color: P.gold, letterSpacing: '0.06em',
      }}>
        {reminder}
      </div>
    </TvRangeScreenBase>
  );
}
