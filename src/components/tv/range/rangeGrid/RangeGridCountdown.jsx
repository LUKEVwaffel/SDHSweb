import { P, mono, fraunces, inter, fs, sp } from '../../../admin/theme.js';
import { useTvUpcomingEvents } from '../../../../hooks/useTvUpcomingEvents.js';
import { getTeam } from '../../../../lib/teams.js';

function targetDate(event) {
  return new Date(`${event.date}T${event.event_time || '00:00:00'}`);
}

function Segment({ value, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{
        fontFamily: fraunces, fontWeight: 900, fontStyle: 'italic', fontSize: 'clamp(18px, 13cqw, 44px)',
        color: P.cream, lineHeight: 0.9, fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </span>
      <span style={{ fontFamily: mono, fontSize: 'clamp(7px, 2.4cqw, 11px)', color: P.gold, letterSpacing: '0.16em', marginTop: 3 }}>
        {label}
      </span>
    </div>
  );
}

function Colon() {
  return (
    <span style={{ fontFamily: fraunces, fontWeight: 900, fontStyle: 'italic', fontSize: 'clamp(14px, 10cqw, 34px)', color: P.hairStrong }}>
      :
    </span>
  );
}

const titleInputStyle = {
  width: '100%', background: 'transparent', border: 'none', borderBottom: `1px dashed ${P.hairStrong}`,
  color: P.gold, fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.24em', padding: '0 0 4px',
  outline: 'none',
};

/**
 * Range-only "until next event" tile — same days/hrs/min math TvCountdownBand
 * (Outside's fixed top band, untouched) uses, rebuilt as a normal addable
 * grid widget so it's movable/removable/resizable instead of forced on.
 * Title is per-tile data (not the shared style-inspector concern); the title
 * and event-title text respect `style` (font/size/bold) like other
 * style-capable kinds — the day/hr/min numerals stay instrument-styled.
 */
export default function RangeGridCountdown({ settings, style, data, editable, onUpdateTile }) {
  const featuredTeams = settings?.featured_teams ?? [];
  const [event] = useTvUpcomingEvents(1, featuredTeams);
  const title = data?.title || 'NEXT EVENT';

  const textFont = style?.fontFamily ?? mono;
  const titleStyle = { fontFamily: textFont, fontSize: fs.micro, letterSpacing: '0.24em', color: P.gold };
  // Bold has nothing else to act on here (no separate body role like
  // NoticeCard/EventCard) — the event title is always emphasized.
  const eventTitleStyle = {
    fontFamily: style?.fontFamily ?? inter, fontSize: style?.fontSize ?? fs.base,
    fontWeight: 700, color: P.cream, marginTop: sp[1],
  };

  return (
    <div style={{
      height: '100%', width: '100%', containerType: 'inline-size', containerName: 'rgCountdown',
      display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: sp[2],
    }}>
      {editable ? (
        <input
          value={title}
          onChange={(e) => onUpdateTile?.({ data: { ...data, title: e.target.value } })}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="NEXT EVENT"
          style={{ ...titleInputStyle, fontFamily: textFont }}
        />
      ) : (
        <div style={titleStyle}>{title}</div>
      )}

      {!event ? (
        <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.faint, fontStyle: 'italic' }}>Nothing on the calendar.</div>
      ) : (() => {
        const diffMs = targetDate(event) - Date.now();
        if (diffMs <= 0) return null;
        const days = Math.floor(diffMs / 86400000);
        const hours = Math.floor((diffMs % 86400000) / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        const teamTag = event.team ? getTeam(event.team)?.label : null;
        return (
          <>
            <div style={eventTitleStyle}>
              {event.title}{teamTag ? <span style={{ color: P.mute, fontWeight: 400 }}> · {teamTag}</span> : null}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: sp[2] }}>
              <Segment value={days} label="DAYS" />
              <Colon />
              <Segment value={String(hours).padStart(2, '0')} label="HRS" />
              <Colon />
              <Segment value={String(minutes).padStart(2, '0')} label="MIN" />
            </div>
          </>
        );
      })()}
    </div>
  );
}
