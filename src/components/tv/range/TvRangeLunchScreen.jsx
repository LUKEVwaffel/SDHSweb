import { P, inter, fs, sp } from '../../admin/theme.js';
import TvRangeScreenBase from './TvRangeScreenBase.jsx';

const DEFAULT_REMINDER = "This is a privilege to sit in here and eat lunch, don't abuse it. All cadets wanting to eat lunch should come within the first 10 minutes of the lunch and cannot leave after that before the ending of the lunch.";

export default function TvRangeLunchScreen({ config }) {
  return (
    <TvRangeScreenBase
      kicker="1ST LUNCH"
      title={config?.lunch1_welcome_message || 'Welcome First Lunch'}
    >
      <div style={{
        maxWidth: 900, fontFamily: inter, fontSize: fs.lg, color: P.mute, lineHeight: 1.6,
        padding: `0 ${sp[4]}px`,
      }}>
        {config?.lunch1_reminder_text || DEFAULT_REMINDER}
      </div>
    </TvRangeScreenBase>
  );
}
