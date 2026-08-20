import { useEffect } from 'react';
import { P, mono, inter, fs, sp } from '../../../admin/theme.js';
import TvRangeScreenBase from '../TvRangeScreenBase.jsx';
import { RenderRuns, storageStringToRuns } from '../rangeGrid/richText.jsx';

// One message, blown up to fill the screen — written directly on this slide
// (config.title/config.message, edited inline in StepRangeSlideshow.jsx),
// not pulled from the shared Announcements tab. Deliberately separate data:
// this slide is for the one thing staff wants featured on its own screen,
// not a mirror of whatever's newest in tv_notices.
export default function SlideAnnouncementSingle({ config, onEmpty }) {
  const titleRuns = storageStringToRuns(config?.title);
  const messageRuns = storageStringToRuns(config?.message);
  const isEmpty = !config?.title && !config?.message;

  useEffect(() => {
    if (isEmpty) onEmpty?.();
  }, [isEmpty, onEmpty]);

  if (isEmpty) {
    return (
      <TvRangeScreenBase kicker="ANNOUNCEMENT" title="Nothing written yet." sub="Add a title and message in the Rotation Screen tab." />
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink, fontFamily: inter,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: sp[16], textAlign: 'center', gap: sp[8], boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: sp[3] }}>
        <div style={{ width: 28, height: 2, background: P.gold }} />
        <span style={{ fontFamily: mono, fontSize: fs.md, color: P.gold, letterSpacing: '0.32em' }}>ANNOUNCEMENT</span>
        <div style={{ width: 28, height: 2, background: P.gold }} />
      </div>

      <div style={{ fontFamily: inter, fontWeight: 800, color: P.cream, fontSize: 'clamp(40px, 7.5vh, 96px)', lineHeight: 1.08, maxWidth: '88vw' }}>
        <RenderRuns runs={titleRuns} />
      </div>

      <div style={{ fontFamily: inter, fontSize: 'clamp(20px, 3.4vh, 40px)', color: P.mute, lineHeight: 1.5, maxWidth: '76vw' }}>
        <RenderRuns runs={messageRuns} />
      </div>
    </div>
  );
}
