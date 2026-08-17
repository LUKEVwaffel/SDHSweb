import { P, mono, inter, fs, sp } from '../../../admin/theme.js';
import { RenderRuns, storageStringToRuns } from '../rangeGrid/richText.jsx';

// Full-bleed version of the grid board's "Announcements" tile — same
// tv_notices data (StepRangeNotices.jsx is still the only place titles/
// messages get typed), just given the whole screen instead of one column,
// since a slide's entire reason to exist is to not compete with anything
// else for room.
function AnnouncementRow({ notice, style }) {
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

export default function SlideAnnouncements({ announcements, style }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink, fontFamily: inter,
      display: 'flex', flexDirection: 'column', padding: `${sp[12]}px ${sp[16]}px`, boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: sp[3], marginBottom: sp[8], flexShrink: 0 }}>
        <div style={{ width: 28, height: 2, background: P.gold }} />
        <span style={{ fontFamily: mono, fontSize: fs.md, color: P.gold, letterSpacing: '0.32em' }}>ANNOUNCEMENTS</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {(announcements ?? []).length ? (
          <div style={{ width: '100%', maxWidth: 1400 }}>
            {announcements.map((n) => <AnnouncementRow key={n.id} notice={n} style={style} />)}
          </div>
        ) : (
          <div style={{ fontFamily: inter, fontSize: fs.lg, color: P.faint, fontStyle: 'italic', margin: 'auto' }}>
            No announcements posted.
          </div>
        )}
      </div>
    </div>
  );
}
