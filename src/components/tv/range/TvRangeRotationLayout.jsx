import { P, mono, inter, fs, sp } from '../../admin/theme.js';
import { useTvNotices } from '../../../hooks/useTvNotices.js';
import { useTvUpcomingEvents } from '../../../hooks/useTvUpcomingEvents.js';
import { getTeam } from '../../../lib/teams.js';
import TvCountdownBand from '../TvCountdownBand.jsx';

function eventDateLabel(event) {
  const d = new Date(`${event.date}T${event.event_time || '00:00:00'}`);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric',
  }).format(d);
}

function PanelHeading({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: sp[4] }}>
      <div style={{ width: 14, height: 2, background: P.gold }} />
      <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.28em' }}>
        {children}
      </div>
      <div style={{ flex: 1, height: 1, background: P.hair }} />
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.faint, fontStyle: 'italic' }}>
      {children}
    </div>
  );
}

function NoticeCard({ notice }) {
  return (
    <div style={{ paddingBottom: sp[4], marginBottom: sp[4], borderBottom: `1px solid ${P.hair}` }}>
      <div style={{ fontFamily: inter, fontSize: fs.base, fontWeight: 700, color: P.cream, marginBottom: sp[1] }}>
        {notice.title}
      </div>
      <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.mute, lineHeight: 1.5 }}>
        {notice.message}
      </div>
    </div>
  );
}

function EventCard({ event }) {
  const teamTag = event.team ? getTeam(event.team)?.label : null;
  return (
    <div style={{ display: 'flex', gap: sp[3], paddingBottom: sp[4], marginBottom: sp[4], borderBottom: `1px solid ${P.hair}` }}>
      <div style={{
        flexShrink: 0, fontFamily: mono, fontSize: fs.xs, color: P.gold, letterSpacing: '0.04em',
        whiteSpace: 'nowrap', paddingTop: 2,
      }}>
        {eventDateLabel(event)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: inter, fontSize: fs.base, fontWeight: 700, color: P.cream }}>
          {event.title}
        </div>
        {teamTag && <div style={{ fontFamily: inter, fontSize: fs.xs, color: P.mute }}>{teamTag}</div>}
      </div>
    </div>
  );
}

// Item 5 (from the previous refinement batch) is the Range welcome screens;
// this is the separate "test for today" ask — Range's rotation phase (the
// TBD photo/widget content) becomes a 3-panel Announcements / Upcoming Events
// / Notes from Staff layout, Outside-only content (TvStandardLayout, still
// used by TvKiosk.jsx) is untouched. Same continuous-instrument-panel grammar
// as the Weather/Clock/Facts column: shared background, hairline dividers,
// mono-gold kickers, no per-panel card chrome.
export default function TvRangeRotationLayout({ settings, now }) {
  const { notices } = useTvNotices('range');
  const events = useTvUpcomingEvents(6);

  const announcements = notices.filter((n) => n.category === 'announcement');
  const staffNotes = notices.filter((n) => n.category === 'staff_note');

  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink,
      display: 'flex', flexDirection: 'column', fontFamily: inter,
    }}>
      <TvCountdownBand settings={settings} now={now} />

      <div style={{
        flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        background: `linear-gradient(180deg, ${P.deep} 0%, #0D1C33 100%)`,
      }}>
        <div style={{ padding: `${sp[6]}px ${sp[6]}px`, overflowY: 'auto', borderRight: `1px solid ${P.hair}` }}>
          <PanelHeading>ANNOUNCEMENTS</PanelHeading>
          {announcements.length ? announcements.map((n) => <NoticeCard key={n.id} notice={n} />) : (
            <EmptyState>No announcements posted.</EmptyState>
          )}
        </div>

        <div style={{ padding: `${sp[6]}px ${sp[6]}px`, overflowY: 'auto', borderRight: `1px solid ${P.hair}` }}>
          <PanelHeading>UPCOMING EVENTS</PanelHeading>
          {events.length ? events.map((e) => <EventCard key={e.id} event={e} />) : (
            <EmptyState>Nothing on the calendar right now.</EmptyState>
          )}
        </div>

        <div style={{ padding: `${sp[6]}px ${sp[6]}px`, overflowY: 'auto' }}>
          <PanelHeading>NOTES FROM STAFF</PanelHeading>
          {staffNotes.length ? staffNotes.map((n) => <NoticeCard key={n.id} notice={n} />) : (
            <EmptyState>No notes from staff.</EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}
