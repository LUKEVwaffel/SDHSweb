import { useEffect } from 'react';
import { P, mono, inter, fs, sp } from '../../../admin/theme.js';
import { RenderRuns, storageStringToRuns } from '../rangeGrid/richText.jsx';

function NoticeRow({ notice, style }) {
  const fontFamily = style?.fontFamily ?? inter;
  return (
    <div style={{ paddingBottom: sp[6], marginBottom: sp[6], borderBottom: `1px solid ${P.hair}`, textAlign: 'left', width: '100%' }}>
      <div style={{ fontFamily, fontSize: style?.fontSize ?? fs.xl, fontWeight: 700, color: P.cream, marginBottom: sp[2] }}>
        <RenderRuns runs={storageStringToRuns(notice.title)} />
      </div>
      <div style={{ fontFamily, fontSize: style?.fontSize ? style.fontSize * 0.62 : fs.lg, fontWeight: style?.bold ? 700 : 400, color: P.mute, lineHeight: 1.5 }}>
        <RenderRuns runs={storageStringToRuns(notice.message)} />
      </div>
    </div>
  );
}

// `notices` starts as [] the instant this mounts — useTvNotices hasn't
// resolved its fetch yet — so an empty list here doesn't necessarily mean
// "nothing posted." Waiting this long before trusting it as genuinely empty
// comfortably covers a normal fetch; if real data lands before the timer
// fires, the effect cleanup below cancels it.
const EMPTY_REPORT_DELAY_MS = 1500;

// Shared full-screen "list of notices" body — Announcements and Staff Notes
// are the same tv_notices shape filtered by category, just a different
// heading/empty copy, so both slide types (SlideAnnouncements.jsx,
// SlideStaffNotes.jsx) render through here. Reports emptiness back to
// TvRangeSlideshowScreen via `onEmpty` so a category with nothing posted
// gets skipped in the rotation instead of sitting on a blank screen for its
// full durationSec.
export default function SlideNoticeList({ notices, heading, emptyLabel, style, onEmpty }) {
  const list = notices ?? [];

  useEffect(() => {
    if (!list.length) {
      const id = setTimeout(() => onEmpty?.(), EMPTY_REPORT_DELAY_MS);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [list.length, onEmpty]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink, fontFamily: inter,
      display: 'flex', flexDirection: 'column', padding: `${sp[12]}px ${sp[16]}px`, boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: sp[3], marginBottom: sp[8], flexShrink: 0 }}>
        <div style={{ width: 28, height: 2, background: P.gold }} />
        <span style={{ fontFamily: mono, fontSize: fs.md, color: P.gold, letterSpacing: '0.32em' }}>{heading}</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {list.length ? (
          <div style={{ width: '100%', maxWidth: 1400 }}>
            {list.map((n) => <NoticeRow key={n.id} notice={n} style={style} />)}
          </div>
        ) : (
          <div style={{ fontFamily: inter, fontSize: fs.lg, color: P.faint, fontStyle: 'italic', margin: 'auto' }}>
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}
