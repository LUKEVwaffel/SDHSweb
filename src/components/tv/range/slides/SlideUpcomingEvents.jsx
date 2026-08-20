import { useEffect } from 'react';
import { P, mono, inter, fs, sp } from '../../../admin/theme.js';
import { getTeam } from '../../../../lib/teams.js';

const MAX_ROWS = 6;

// `events` starts as [] the instant this mounts — useTvUpcomingEvents hasn't
// resolved its fetch yet — so an empty list here doesn't necessarily mean
// nothing's on the calendar. If real data lands before this fires, the
// effect cleanup below cancels it.
const EMPTY_REPORT_DELAY_MS = 1500;

function eventDateLabel(event) {
  const d = new Date(`${event.date}T${event.event_time || '00:00:00'}`);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric',
  }).format(d);
}

function EventRow({ event, style }) {
  const fontFamily = style?.fontFamily ?? inter;
  const teamTag = event.team ? getTeam(event.team)?.label : null;
  return (
    <div style={{ display: 'flex', gap: sp[5], paddingBottom: sp[6], marginBottom: sp[6], borderBottom: `1px solid ${P.hair}`, textAlign: 'left', width: '100%' }}>
      <div style={{
        flexShrink: 0, fontFamily: mono, fontSize: fs.md, color: P.gold, letterSpacing: '0.04em',
        whiteSpace: 'nowrap', paddingTop: 4,
      }}>
        {eventDateLabel(event)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily, fontSize: style?.fontSize ?? fs.xl, fontWeight: 700, color: P.cream }}>{event.title}</div>
        {teamTag && <div style={{ fontFamily, fontSize: fs.sm, color: P.mute, marginTop: 2 }}>{teamTag}</div>}
      </div>
    </div>
  );
}

// Full-screen version of the Grid Layout's "events" tile. Caps rows at
// MAX_ROWS — the caller (TvRangeSlideshowScreen.jsx) is fed a longer
// upstream list shared with the uniform-countdown slide's event picker, but
// a full screen only has room for a handful before it stops being readable
// from across the room.
export default function SlideUpcomingEvents({ events, style, onEmpty }) {
  const list = (events ?? []).slice(0, MAX_ROWS);

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
        <span style={{ fontFamily: mono, fontSize: fs.md, color: P.gold, letterSpacing: '0.32em' }}>UPCOMING EVENTS</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {list.length ? (
          <div style={{ width: '100%', maxWidth: 1400 }}>
            {list.map((e) => <EventRow key={e.id} event={e} style={style} />)}
          </div>
        ) : (
          <div style={{ fontFamily: inter, fontSize: fs.lg, color: P.faint, fontStyle: 'italic', margin: 'auto' }}>
            Nothing on the calendar right now.
          </div>
        )}
      </div>
    </div>
  );
}
