import { P, mono, oswald, fraunces, fs, sp } from '../admin/theme.js';
import { useTvUpcomingEvents } from '../../hooks/useTvUpcomingEvents.js';
import { getTeam } from '../../lib/teams.js';

// Target = event.date + event.event_time (falls back to local midnight when
// no time is set) — same "browser IS the kiosk, so local time IS NY time"
// assumption TvTopStrip.jsx's daysUntil() already makes, not re-deriving a
// separate NY-anchored Date here.
function targetDate(event) {
  return new Date(`${event.date}T${event.event_time || '00:00:00'}`);
}

function Segment({ value, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{
        fontFamily: fraunces, fontWeight: 900, fontStyle: 'italic', fontSize: 44,
        color: P.cream, lineHeight: 0.9, fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </span>
      <span style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.2em', marginTop: 4 }}>
        {label}
      </span>
    </div>
  );
}

function Colon() {
  return (
    <span style={{ fontFamily: fraunces, fontWeight: 900, fontStyle: 'italic', fontSize: 34, color: P.hairStrong }}>
      :
    </span>
  );
}

/**
 * Hero countdown to the next upcoming battalion/featured-team event.
 * Auto-picks — no event picker, unlike the original mockup, since real data
 * makes "next event" always correct on its own (see plan). Omits itself
 * entirely when nothing's scheduled, same convention as every other
 * optional /tv section (TvTopStrip's ticker row, TvBottomWidget under
 * emergency mode).
 */
export default function TvCountdownBand({ settings, now }) {
  const featuredTeams = settings?.featured_teams ?? [];
  const [event] = useTvUpcomingEvents(1, featuredTeams);

  if (!event) return null;

  const diffMs = targetDate(event) - now;
  if (diffMs <= 0) return null;

  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  const teamTag = event.team ? getTeam(event.team)?.label : null;

  return (
    <div style={{
      position: 'relative', zIndex: 1, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: sp[6],
      padding: `0 ${sp[8]}px`, height: 96, overflow: 'hidden',
      background: `linear-gradient(90deg, ${P.deep} 0%, ${P.navy} 100%)`,
      borderBottom: `1px solid ${P.hairStrong}`,
    }}>
      {/* Same grid+glow texture as the Range welcome screen, scaled down for
          the band's 96px height — decorative only, content stays legible. */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5,
        backgroundImage: `linear-gradient(${P.hair} 1px, transparent 1px), linear-gradient(90deg, ${P.hair} 1px, transparent 1px)`,
        backgroundSize: '32px 32px',
        maskImage: 'radial-gradient(ellipse 60% 100% at 50% 50%, black 0%, transparent 85%)',
        WebkitMaskImage: 'radial-gradient(ellipse 60% 100% at 50% 50%, black 0%, transparent 85%)',
      }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: sp[2] }}>
          <div style={{ width: 14, height: 2, background: P.gold }} />
          <span style={{ fontFamily: mono, fontSize: fs.xs, color: P.gold, letterSpacing: '0.28em' }}>
            NEXT UP
          </span>
        </div>
        <div style={{
          fontFamily: oswald, fontSize: fs.xl, color: P.cream,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '48vw',
        }}>
          {event.title}{teamTag ? <span style={{ color: P.mute, fontSize: fs.base }}> · {teamTag}</span> : null}
        </div>
      </div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: sp[4], flexShrink: 0 }}>
        <Segment value={days} label="DAYS" />
        <Colon />
        <Segment value={String(hours).padStart(2, '0')} label="HRS" />
        <Colon />
        <Segment value={String(minutes).padStart(2, '0')} label="MIN" />
      </div>
    </div>
  );
}
