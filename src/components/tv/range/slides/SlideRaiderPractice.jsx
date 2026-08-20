import { P, inter, sp } from '../../../admin/theme.js';
import TvRangeRaiderPracticeWidget from '../TvRangeRaiderPracticeWidget.jsx';

// Full-screen version of the Grid Layout's "raider" tile — previously
// gated behind a separate showRaiderPractice checkbox (StepRangeSchedule.jsx);
// now it's just a slide like any other, added from the gallery. Content is
// static (RAIDER_PRACTICE_TILES), so this never has an empty state to report.
// The widget draws its own "RAIDERS PRACTICE" heading, so this wrapper is
// just centering/sizing chrome.
export default function SlideRaiderPractice({ rangeConfig, style }) {
  const groupmeUrl = rangeConfig?.groupme_url ?? rangeConfig?.groupmeUrl;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink, fontFamily: inter,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: sp[16], boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        <TvRangeRaiderPracticeWidget groupmeUrl={groupmeUrl} style={style} />
      </div>
    </div>
  );
}
